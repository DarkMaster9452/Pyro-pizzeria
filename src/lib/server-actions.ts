"use server";

import { sql } from "./db";
import { auth } from "@/auth";
import { registerUser, getSessionVersion } from "./users";
import {
  RESTAURANTS,
  PRODUCTS,
  SHARED_PRODUCTS,
  COUPONS,
  EXTRA_INGREDIENTS,
  EXTRA_CHEESE_PRICE,
  STUFFED_CRUST_PRICE,
} from "./data";
import { computeTotals } from "./pricing";
import { estimatedWait, shortId, formatAddress } from "./utils";
import { orderInputSchema, firstError } from "./validation";
import { rateLimit, audit, clientIp } from "./security";
import type {
  CartLine,
  DeliveryZone,
  Product,
  Coupon,
  CategoryId,
  ProductSize,
  Badge,
} from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;

function pizzaIds(products: Product[]): Set<string> {
  return new Set(
    products.filter((p) => p.category === "pizza").map((p) => p.id)
  );
}

function pizzaCount(lines: CartLine[], pizza: Set<string>): number {
  return lines.reduce(
    (n, l) => n + (pizza.has(l.productId) ? l.quantity : 0),
    0
  );
}

// ---------------------------------------------------------------------------
// Content tables (products / coupons / delivery zones) — created and seeded
// lazily so the app is self-bootstrapping. After the first seed the database
// is the source of truth and admins edit it directly.
// ---------------------------------------------------------------------------
let seedPromise: Promise<void> | null = null;

async function ensureContent(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id text PRIMARY KEY,
        restaurant_id text NOT NULL,
        category text NOT NULL,
        name text NOT NULL,
        description text NOT NULL DEFAULT '',
        image text NOT NULL DEFAULT '',
        base_price numeric(8,2) NOT NULL DEFAULT 0,
        sizes jsonb NOT NULL DEFAULT '[]'::jsonb,
        ingredients jsonb NOT NULL DEFAULT '[]'::jsonb,
        allergens jsonb NOT NULL DEFAULT '[]'::jsonb,
        badges jsonb NOT NULL DEFAULT '[]'::jsonb,
        available boolean NOT NULL DEFAULT true,
        sort int NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`;
    await sql`CREATE INDEX IF NOT EXISTS products_restaurant_idx ON products (restaurant_id, sort)`;
    await sql`
      CREATE TABLE IF NOT EXISTS coupons (
        code text PRIMARY KEY,
        restaurant_id text NOT NULL DEFAULT 'all',
        type text NOT NULL,
        value numeric(8,2) NOT NULL DEFAULT 0,
        min_subtotal numeric(8,2) NOT NULL DEFAULT 0,
        label text NOT NULL DEFAULT '',
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
    await sql`
      CREATE TABLE IF NOT EXISTS delivery_zones (
        id text PRIMARY KEY,
        restaurant_id text NOT NULL,
        name text NOT NULL,
        minimum_order numeric(8,2) NOT NULL DEFAULT 0,
        delivery_fee numeric(8,2) NOT NULL DEFAULT 0,
        estimated_minutes int NOT NULL DEFAULT 45,
        areas jsonb NOT NULL DEFAULT '[]'::jsonb,
        sort int NOT NULL DEFAULT 0
      )`;
    await sql`CREATE INDEX IF NOT EXISTS delivery_zones_restaurant_idx ON delivery_zones (restaurant_id, sort)`;

    // The menu is shared across both pizzerias, stored once as restaurant_id
    // 'all'. Collapse any legacy per-restaurant rows into that shared set
    // (Pyro is canonical), so an edit in the admin updates both storefronts.
    const legacy = (await sql`
      SELECT COUNT(*)::int AS n FROM products WHERE restaurant_id <> 'all'
    `) as { n: number }[];
    if ((legacy[0]?.n ?? 0) > 0) {
      await sql`
        INSERT INTO products (id, restaurant_id, category, name, description,
          image, base_price, sizes, ingredients, allergens, badges, available, sort)
        SELECT regexp_replace(id, '^pyro-', ''), 'all', category, name,
          description, image, base_price, sizes, ingredients, allergens, badges,
          available, sort
        FROM products WHERE restaurant_id = 'pyro'
        ON CONFLICT (id) DO NOTHING`;
      await sql`DELETE FROM products WHERE restaurant_id <> 'all'`;
    }
    // Drinks were removed from the menu — drop any that lingered.
    await sql`DELETE FROM products WHERE category = 'drinks'`;

    const pc = (await sql`SELECT COUNT(*)::int AS n FROM products`) as {
      n: number;
    }[];
    if ((pc[0]?.n ?? 0) === 0) {
      let i = 0;
      for (const p of SHARED_PRODUCTS) {
        await sql`
          INSERT INTO products (id, restaurant_id, category, name, description,
            image, base_price, sizes, ingredients, allergens, badges, available, sort)
          VALUES (${p.id}, 'all', ${p.category}, ${p.name},
            ${p.description}, ${p.image}, ${p.basePrice},
            ${JSON.stringify(p.sizes)}, ${JSON.stringify(p.ingredients)},
            ${JSON.stringify(p.allergens)}, ${JSON.stringify(p.badges)},
            ${p.available}, ${i++})
          ON CONFLICT (id) DO NOTHING`;
      }
    }

    const cc = (await sql`SELECT COUNT(*)::int AS n FROM coupons`) as {
      n: number;
    }[];
    if ((cc[0]?.n ?? 0) === 0) {
      for (const c of COUPONS) {
        await sql`
          INSERT INTO coupons (code, restaurant_id, type, value, min_subtotal, label)
          VALUES (${c.code}, ${c.restaurantId}, ${c.type}, ${c.value},
            ${c.minSubtotal}, ${c.label})
          ON CONFLICT (code) DO NOTHING`;
      }
    }

    const zc = (await sql`SELECT COUNT(*)::int AS n FROM delivery_zones`) as {
      n: number;
    }[];
    if ((zc[0]?.n ?? 0) === 0) {
      for (const r of RESTAURANTS) {
        let zi = 0;
        for (const z of r.deliveryZones) {
          await sql`
            INSERT INTO delivery_zones (id, restaurant_id, name, minimum_order,
              delivery_fee, estimated_minutes, areas, sort)
            VALUES (${z.id}, ${r.id}, ${z.name}, 0, ${z.deliveryFee},
              ${z.estimatedMinutes}, ${JSON.stringify(z.areas)}, ${zi++})
            ON CONFLICT (id) DO NOTHING`;
        }
      }
    }
  })().catch((e) => {
    // allow a later retry if bootstrap failed
    seedPromise = null;
    throw e;
  });
  return seedPromise;
}

// The `orders` table predates the delivery-dispatch feature, so add the extra
// columns lazily (idempotent). Memoised so the ALTERs run at most once.
let orderColumnsPromise: Promise<void> | null = null;
async function ensureOrderColumns(): Promise<void> {
  if (orderColumnsPromise) return orderColumnsPromise;
  orderColumnsPromise = (async () => {
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id text`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_id text`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_name text`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at timestamptz`;
    await sql`CREATE INDEX IF NOT EXISTS orders_driver_idx ON orders (driver_id)`;
    await sql`CREATE INDEX IF NOT EXISTS orders_user_idx ON orders (user_id)`;
    // Human-friendly, sequential order numbers (e.g. #1001) instead of random
    // codes. Used as the order id/PK.
    await sql`CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1001`;
    // Daily open / availability / staff shifts.
    await sql`ALTER TABLE restaurant_state ADD COLUMN IF NOT EXISTS open_date date`;
    await sql`
      CREATE TABLE IF NOT EXISTS daily_unavailable (
        restaurant_id text NOT NULL,
        product_id text NOT NULL,
        service_date date NOT NULL,
        PRIMARY KEY (restaurant_id, product_id, service_date)
      )`;
    await sql`
      CREATE TABLE IF NOT EXISTS shifts (
        id text PRIMARY KEY,
        restaurant_id text NOT NULL,
        user_id text NOT NULL,
        name text NOT NULL,
        role text NOT NULL,
        service_date date NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (restaurant_id, user_id, service_date)
      )`;
    await sql`CREATE INDEX IF NOT EXISTS shifts_date_idx ON shifts (restaurant_id, service_date)`;
  })().catch((e) => {
    orderColumnsPromise = null;
    throw e;
  });
  return orderColumnsPromise;
}

// The service day rolls over at 12:00 Europe/Bratislava — that's also when the
// daily "available items" reset. Inlined into queries as a literal expression.
const SERVICE_DATE =
  "((now() AT TIME ZONE 'Europe/Bratislava') - interval '12 hours')::date";

// Next sequential order number (as text, since the order id is a text PK).
// Falls back to a random code if the sequence is somehow unavailable.
async function nextOrderId(): Promise<string> {
  try {
    const rows = (await sql`SELECT nextval('order_number_seq') AS n`) as {
      n: number | string;
    }[];
    if (rows[0]?.n != null) return String(rows[0].n);
  } catch (e) {
    console.error("nextOrderId failed, falling back", e);
  }
  return shortId();
}

interface ProductRow {
  id: string;
  restaurant_id: string;
  category: string;
  name: string;
  description: string;
  image: string;
  base_price: string;
  sizes: ProductSize[];
  ingredients: string[];
  allergens: string[];
  badges: Badge[];
  available: boolean;
}

function rowToProduct(r: ProductRow): Product {
  return {
    id: r.id,
    restaurantId: r.restaurant_id,
    category: r.category as CategoryId,
    name: r.name,
    description: r.description,
    image: r.image,
    basePrice: Number(r.base_price),
    sizes: Array.isArray(r.sizes) ? r.sizes : [],
    ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
    allergens: Array.isArray(r.allergens) ? r.allergens : [],
    badges: Array.isArray(r.badges) ? r.badges : [],
    available: r.available,
  };
}

interface ZoneRow {
  id: string;
  restaurant_id: string;
  name: string;
  minimum_order: string;
  delivery_fee: string;
  estimated_minutes: number;
  areas: string[];
}

function rowToZone(z: ZoneRow): DeliveryZone {
  return {
    id: z.id,
    name: z.name,
    minimumOrder: Number(z.minimum_order),
    deliveryFee: Number(z.delivery_fee),
    estimatedMinutes: z.estimated_minutes,
    areas: Array.isArray(z.areas) ? z.areas : [],
  };
}

interface CouponRow {
  code: string;
  restaurant_id: string;
  type: string;
  value: string;
  min_subtotal: string;
  label: string;
}

function rowToCoupon(c: CouponRow): Coupon {
  return {
    code: c.code,
    restaurantId: c.restaurant_id as Coupon["restaurantId"],
    type: c.type as Coupon["type"],
    value: Number(c.value),
    minSubtotal: Number(c.min_subtotal),
    label: c.label,
  };
}

async function loadProducts(): Promise<Product[]> {
  const rows = (await sql`
    SELECT id, restaurant_id, category, name, description, image, base_price,
           sizes, ingredients, allergens, badges, available
    FROM products WHERE category <> 'drinks' ORDER BY sort`) as ProductRow[];
  const shared = rows.map(rowToProduct);
  // Expand the single shared menu ("all") into per-restaurant products so the
  // storefront and cart keep matching by "<restaurantId>-<slug>" ids.
  const out: Product[] = [];
  for (const r of RESTAURANTS)
    for (const p of shared)
      out.push({ ...p, id: `${r.id}-${p.id}`, restaurantId: r.id });
  return out;
}

// -------- Public storefront snapshot (menu, zones, coupons) --------
export interface Storefront {
  products: Product[];
  coupons: Coupon[];
  zones: Record<string, DeliveryZone[]>;
  open: Record<string, boolean>; // manually opened for today's service day
}

export async function getStorefront(): Promise<Storefront> {
  try {
    await ensureContent();
    await ensureOrderColumns();
    let products = await loadProducts();
    // Hide items the admin marked unavailable for today (per restaurant).
    const unavRows = (await sql.query(
      `SELECT restaurant_id, product_id FROM daily_unavailable
       WHERE service_date = ${SERVICE_DATE}`,
      []
    )) as { restaurant_id: string; product_id: string }[];
    if (unavRows.length) {
      const unav = new Set(
        unavRows.map((u) => `${u.restaurant_id}-${u.product_id}`)
      );
      products = products.filter((p) => !unav.has(p.id));
    }
    const couponRows = (await sql`
      SELECT code, restaurant_id, type, value, min_subtotal, label
      FROM coupons WHERE active = true`) as CouponRow[];
    const zoneRows = (await sql`
      SELECT id, restaurant_id, name, minimum_order, delivery_fee,
             estimated_minutes, areas
      FROM delivery_zones ORDER BY restaurant_id, sort`) as ZoneRow[];
    const zones: Record<string, DeliveryZone[]> = {};
    for (const z of zoneRows) {
      (zones[z.restaurant_id] ??= []).push(rowToZone(z));
    }
    const openRows = (await sql.query(
      `SELECT id, COALESCE(open_date = ${SERVICE_DATE}, false) AS is_open
       FROM restaurant_state`,
      []
    )) as { id: string; is_open: boolean }[];
    const open: Record<string, boolean> = {};
    for (const o of openRows) open[o.id] = !!o.is_open;
    return {
      products: products.length ? products : PRODUCTS,
      coupons: couponRows.map(rowToCoupon),
      zones,
      open,
    };
  } catch {
    // Fall back to the static seed so the storefront always renders.
    const zones: Record<string, DeliveryZone[]> = {};
    const open: Record<string, boolean> = {};
    for (const r of RESTAURANTS) {
      zones[r.id] = r.deliveryZones;
      open[r.id] = true; // fail open so the site still works if DB is down
    }
    return { products: PRODUCTS, coupons: COUPONS, zones, open };
  }
}

function matchZone(zones: DeliveryZone[], query: string): DeliveryZone | null {
  const norm = (s: string) =>
    s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const q = norm(query);
  if (!q) return null;
  for (const zone of zones) {
    for (const area of zone.areas) {
      const a = norm(area);
      if (a && (q.includes(a) || a.includes(q))) return zone;
    }
  }
  return null;
}

// -------- Registration (also used by the register form action) --------
export async function registerAction(
  name: string,
  email: string,
  password: string
) {
  return registerUser(name, email, password);
}

// -------- Sold-out state (public read) --------
export async function getRestaurantStates(): Promise<Record<string, boolean>> {
  try {
    const rows = (await sql`SELECT id, sold_out FROM restaurant_state`) as {
      id: string;
      sold_out: boolean;
    }[];
    const out: Record<string, boolean> = {};
    for (const r of rows) out[r.id] = r.sold_out;
    return out;
  } catch {
    return {};
  }
}

// -------- Create order (server recomputes ALL money) --------
export interface NewOrderInput {
  restaurantId: string;
  fulfillment: "delivery" | "pickup";
  customerName: string;
  phone: string;
  email?: string;
  address?: { street: string; houseNumber: string; city: string; zip: string };
  lines: CartLine[];
  couponCode?: string | null;
  note?: string;
  payment?: "cash_delivery" | "card_delivery" | "cash_pickup" | "card_pickup";
}

const PAYMENT_LABELS: Record<string, string> = {
  cash_delivery: "Hotovosť pri doručení",
  card_delivery: "Karta pri doručení",
  cash_pickup: "Hotovosť pri odbere",
  card_pickup: "Karta pri odbere",
};

export interface CreateOrderResult {
  ok: boolean;
  id?: string;
  error?: string;
  total?: number;
  eta?: number;
}

// Re-price a cart line from the DATABASE menu — the client's unitPrice is
// discarded. Returns null for an unknown / unavailable product.
function repriceLine(
  line: CartLine,
  products: Product[],
  restaurantId: string
): CartLine | null {
  const product = products.find(
    (p) => p.id === line.productId && p.restaurantId === restaurantId
  );
  if (!product || !product.available) return null;
  const size =
    product.sizes.find((s) => s.id === line.sizeId) ?? product.sizes[0];
  let unit = product.basePrice + (size?.priceDelta ?? 0);
  if (line.extraCheese) unit += EXTRA_CHEESE_PRICE;
  if (line.stuffedCrust) unit += STUFFED_CRUST_PRICE;
  for (const name of line.addedIngredients) {
    const ing = EXTRA_INGREDIENTS.find((i) => i.name === name);
    if (ing) unit += ing.price;
  }
  return {
    ...line,
    name: product.name,
    image: product.image,
    sizeLabel: size?.label ?? line.sizeLabel,
    unitPrice: round2(unit),
    quantity: Math.min(50, Math.max(1, Math.floor(line.quantity))),
  };
}

export async function createOrder(
  input: NewOrderInput
): Promise<CreateOrderResult> {
  const parsed = orderInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const data = parsed.data;

  const ip = await clientIp();
  const rl = await rateLimit("order", ip, 12, 10 * 60);
  if (!rl.allowed)
    return { ok: false, error: "Príliš veľa objednávok. Skúste o chvíľu." };

  const restaurant = RESTAURANTS.find((r) => r.id === data.restaurantId);
  if (!restaurant) return { ok: false, error: "Neznáma prevádzka." };

  try {
    await ensureContent();
    await ensureOrderColumns();

    // Link the order to the signed-in customer's account (if any) so it shows
    // up in their order history.
    const session = await auth();
    const userId = session?.user?.id ?? null;

    // sold-out + manually-opened (authoritative, from DB)
    const state = (await sql.query(
      `SELECT sold_out, COALESCE(open_date = ${SERVICE_DATE}, false) AS is_open
       FROM restaurant_state WHERE id = $1 LIMIT 1`,
      [data.restaurantId]
    )) as { sold_out: boolean; is_open: boolean }[];
    if (state[0]?.sold_out)
      return { ok: false, error: "Prevádzka je momentálne vypredaná." };
    if (!state[0]?.is_open)
      return {
        ok: false,
        error: "Prevádzka ešte nie je dnes otvorená. Skúste neskôr.",
      };

    // items the admin marked unavailable for today
    const unavRows = (await sql.query(
      `SELECT product_id FROM daily_unavailable
       WHERE restaurant_id = $1 AND service_date = ${SERVICE_DATE}`,
      [data.restaurantId]
    )) as { product_id: string }[];
    const unavToday = new Set(
      unavRows.map((u) => `${data.restaurantId}-${u.product_id}`)
    );

    const products = await loadProducts();
    const pizza = pizzaIds(products.length ? products : PRODUCTS);

    // re-price every line from the menu (ignore client prices)
    const lines: CartLine[] = [];
    for (const l of data.lines) {
      if (unavToday.has((l as CartLine).productId))
        return { ok: false, error: "Niektorá položka dnes nie je dostupná." };
      const priced = repriceLine(
        l as CartLine,
        products.length ? products : PRODUCTS,
        data.restaurantId
      );
      if (!priced)
        return { ok: false, error: "Niektorý produkt už nie je dostupný." };
      lines.push(priced);
    }

    // resolve delivery zone + fee server-side (from DB zones)
    let zone: DeliveryZone | null = null;
    if (data.fulfillment === "delivery") {
      if (!data.address)
        return { ok: false, error: "Chýba adresa doručenia." };
      if (
        !data.address.street.trim() ||
        !data.address.houseNumber.trim() ||
        !data.address.city.trim()
      )
        return {
          ok: false,
          error: "Vyplňte ulicu, číslo domu a mesto.",
        };
      const restaurantZones = (await sql`
        SELECT id, restaurant_id, name, minimum_order, delivery_fee,
               estimated_minutes, areas
        FROM delivery_zones WHERE restaurant_id = ${data.restaurantId}
        ORDER BY sort`) as ZoneRow[];
      const usable = restaurantZones.length
        ? restaurantZones.map(rowToZone)
        : restaurant.deliveryZones;
      zone = matchZone(usable, `${data.address.street} ${data.address.city}`);
      if (!zone)
        return { ok: false, error: "Na túto adresu nedoručujeme." };
    }

    // Enforce the zone's minimum order (admin-configurable). The subtotal is
    // computed from server-repriced lines, so this can't be bypassed.
    if (zone && zone.minimumOrder > 0) {
      const lineSubtotal = lines.reduce(
        (s, l) => s + l.unitPrice * l.quantity,
        0
      );
      if (lineSubtotal < zone.minimumOrder)
        return {
          ok: false,
          error: `Minimálna objednávka pre zónu ${zone.name} je ${zone.minimumOrder.toFixed(
            2
          )} €.`,
        };
    }

    // coupons from DB
    const couponRows = (await sql`
      SELECT code, restaurant_id, type, value, min_subtotal, label
      FROM coupons WHERE active = true`) as CouponRow[];
    const coupons = couponRows.length
      ? couponRows.map(rowToCoupon)
      : COUPONS;

    const totals = computeTotals(
      lines,
      data.restaurantId,
      zone,
      data.fulfillment,
      data.couponCode ?? null,
      coupons
    );

    // ETA from current kitchen load
    const pending = (await sql`
      SELECT COALESCE(SUM(pizza_count),0)::int AS p FROM orders
      WHERE restaurant_id = ${data.restaurantId}
        AND status IN ('received','accepted','preparing')
    `) as { p: number }[];
    const wait = estimatedWait(
      restaurant.prepTimeMinutes,
      (pending[0]?.p ?? 0) + pizzaCount(lines, pizza)
    );
    const eta = zone ? Math.max(zone.estimatedMinutes, wait) : wait;

    // Payment label from the chosen method (validated), default per fulfillment.
    const paymentLabel =
      (data.payment && PAYMENT_LABELS[data.payment]) ??
      (data.fulfillment === "delivery"
        ? "Platba pri doručení"
        : "Platba pri odbere");

    const id = await nextOrderId();
    await sql`
      INSERT INTO orders (
        id, restaurant_id, status, fulfillment, customer_name, phone, email,
        address, zone_name, lines, pizza_count, subtotal, delivery_fee,
        discount, total, payment, note, eta, user_id
      ) VALUES (
        ${id}, ${data.restaurantId}, 'received', ${data.fulfillment},
        ${data.customerName}, ${data.phone}, ${data.email || null},
        ${data.address ? JSON.stringify(data.address) : null},
        ${zone?.name ?? null}, ${JSON.stringify(lines)},
        ${pizzaCount(lines, pizza)},
        ${totals.subtotal}, ${totals.deliveryFee}, ${totals.discount},
        ${totals.total},
        ${paymentLabel},
        ${data.note || null}, ${eta}, ${userId}
      )
    `;
    await audit({
      action: "order.created",
      restaurantId: data.restaurantId,
      target: id,
      meta: { total: totals.total, fulfillment: data.fulfillment, ip },
    });
    return { ok: true, id, total: totals.total, eta };
  } catch (e) {
    console.error("createOrder failed", e);
    return { ok: false, error: "Objednávku sa nepodarilo uložiť." };
  }
}

// -------- Admin context --------
export async function getAdminContext(): Promise<{
  restaurantId: string;
  name: string;
  email: string;
} | null> {
  const session = await auth();
  if (
    (session?.user?.role !== "admin" && session?.user?.role !== "super_admin") ||
    !session.user.restaurantId
  )
    return null;
  return {
    restaurantId: session.user.restaurantId,
    name: session.user.name ?? "Admin",
    email: session.user.email ?? "",
  };
}

// -------- Admin: guard (authn + authz + session revocation) --------
async function requireAdmin(restaurantId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = session.user.role;
  if (role !== "admin" && role !== "super_admin")
    throw new Error("Unauthorized");
  if (session.user.restaurantId !== restaurantId)
    throw new Error("Forbidden");
  const current = await getSessionVersion(session.user.id);
  if (current !== null && current !== session.user.sessionVersion)
    throw new Error("Session revoked");
  return session;
}

export interface AdminOrderRow {
  id: string;
  status: string;
  fulfillment: string;
  customerName: string;
  total: number;
  pizzaCount: number;
  minsAgo: number;
  createdAt: string; // ISO — used to sort the kitchen FIFO + show the time
  paid: boolean;
  driverName: string | null;
  lines: { name: string; quantity: number }[];
}

interface AdminOrderRaw {
  id: string;
  status: string;
  fulfillment: string;
  customer_name: string;
  total: number;
  pizza_count: number;
  lines: { name: string; quantity: number }[];
  paid: boolean;
  driver_name: string | null;
  created_at: string;
  mins_ago: number;
}

function mapAdminOrderRow(o: AdminOrderRaw): AdminOrderRow {
  return {
    id: o.id,
    status: o.status,
    fulfillment: o.fulfillment,
    customerName: o.customer_name,
    total: o.total,
    pizzaCount: o.pizza_count,
    minsAgo: Math.max(0, Math.round(o.mins_ago)),
    createdAt: o.created_at,
    paid: o.paid,
    driverName: o.driver_name,
    lines: Array.isArray(o.lines) ? o.lines : [],
  };
}

const ADMIN_ORDER_COLS = `id, status, fulfillment, customer_name, total::float AS total,
  pizza_count, lines, COALESCE(paid, false) AS paid, driver_name, created_at,
  EXTRACT(EPOCH FROM (now() - created_at))/60 AS mins_ago`;

// Distinct calendar days (Europe/Bratislava) that have orders — powers the day
// filter in the admin orders tab. Days with no orders never appear.
export async function getOrderDays(restaurantId: string): Promise<string[]> {
  await requireAdmin(restaurantId);
  await ensureOrderColumns();
  const rows = (await sql`
    SELECT DISTINCT (created_at AT TIME ZONE 'Europe/Bratislava')::date::text AS d
    FROM orders WHERE restaurant_id = ${restaurantId}
    ORDER BY d DESC LIMIT 30
  `) as { d: string }[];
  return rows.map((r) => r.d);
}

// Orders for a specific calendar day (YYYY-MM-DD), or the most recent when day
// is null.
export async function getAdminOrdersByDay(
  restaurantId: string,
  day: string | null
): Promise<AdminOrderRow[]> {
  await requireAdmin(restaurantId);
  await ensureOrderColumns();
  const rows = day
    ? ((await sql.query(
        `SELECT ${ADMIN_ORDER_COLS} FROM orders
         WHERE restaurant_id = $1
           AND (created_at AT TIME ZONE 'Europe/Bratislava')::date = $2::date
         ORDER BY created_at DESC LIMIT 200`,
        [restaurantId, day]
      )) as AdminOrderRaw[])
    : ((await sql.query(
        `SELECT ${ADMIN_ORDER_COLS} FROM orders
         WHERE restaurant_id = $1
         ORDER BY created_at DESC LIMIT 60`,
        [restaurantId]
      )) as AdminOrderRaw[]);
  return rows.map(mapAdminOrderRow);
}

export interface AdminSummary {
  soldOut: boolean;
  pendingCount: number;
  pendingPizzas: number;
  waitMinutes: number;
  soldToday: number;
  ordersToday: number;
  revenueToday: number;
  week: { label: string; value: number }[];
  topProducts: { name: string; value: number }[];
  orders: AdminOrderRow[];
}

const DAY_LABELS = ["Ne", "Po", "Ut", "St", "Št", "Pi", "So"];

export async function getAdminSummary(
  restaurantId: string
): Promise<AdminSummary> {
  await requireAdmin(restaurantId);
  await ensureOrderColumns();
  const base =
    RESTAURANTS.find((r) => r.id === restaurantId)?.prepTimeMinutes ?? 45;

  const boundarySql = `(
    (date_trunc('day', (now() AT TIME ZONE 'Europe/Bratislava'))
      + CASE WHEN (now() AT TIME ZONE 'Europe/Bratislava')
                  >= date_trunc('day', (now() AT TIME ZONE 'Europe/Bratislava')) + interval '12 hours'
             THEN interval '12 hours' ELSE interval '-12 hours' END
    ) AT TIME ZONE 'Europe/Bratislava'
  )`;

  const pending = (await sql`
    SELECT COALESCE(SUM(pizza_count),0)::int AS pizzas, COUNT(*)::int AS cnt
    FROM orders
    WHERE restaurant_id = ${restaurantId}
      AND status IN ('received','accepted','preparing')
  `) as { pizzas: number; cnt: number }[];

  const today = (await sql.query(
    `SELECT COALESCE(SUM(pizza_count),0)::int AS pizzas,
            COUNT(*)::int AS cnt,
            COALESCE(SUM(total),0)::float AS revenue
     FROM orders
     WHERE restaurant_id = $1 AND status <> 'cancelled'
       AND created_at >= ${boundarySql}`,
    [restaurantId]
  )) as { pizzas: number; cnt: number; revenue: number }[];

  // real 7-day revenue (for the dashboard bar chart)
  const weekRows = (await sql`
    SELECT EXTRACT(DOW FROM (created_at AT TIME ZONE 'Europe/Bratislava'))::int AS dow,
           (date_trunc('day', (created_at AT TIME ZONE 'Europe/Bratislava')))::date AS d,
           COALESCE(SUM(total),0)::float AS revenue
    FROM orders
    WHERE restaurant_id = ${restaurantId} AND status <> 'cancelled'
      AND created_at >= now() - interval '7 days'
    GROUP BY 1, 2
  `) as { dow: number; d: string; revenue: number }[];
  const revByDate = new Map(weekRows.map((r) => [r.d, r.revenue]));
  const week: { label: string; value: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dt = new Date();
    dt.setDate(dt.getDate() - i);
    const key = dt.toISOString().slice(0, 10);
    week.push({
      label: DAY_LABELS[dt.getDay()],
      value: Math.round(revByDate.get(key) ?? 0),
    });
  }

  // real top products (by quantity across all non-cancelled orders)
  const topRows = (await sql`
    SELECT l->>'name' AS name, SUM((l->>'quantity')::int)::int AS qty
    FROM orders, jsonb_array_elements(lines) AS l
    WHERE restaurant_id = ${restaurantId} AND status <> 'cancelled'
    GROUP BY 1 ORDER BY qty DESC LIMIT 5
  `) as { name: string; qty: number }[];

  const orderRows = (await sql`
    SELECT id, status, fulfillment, customer_name, total::float AS total,
           pizza_count, lines, COALESCE(paid, false) AS paid, driver_name,
           created_at,
           EXTRACT(EPOCH FROM (now() - created_at))/60 AS mins_ago
    FROM orders
    WHERE restaurant_id = ${restaurantId}
    ORDER BY created_at DESC
    LIMIT 40
  `) as Array<{
    id: string;
    status: string;
    fulfillment: string;
    customer_name: string;
    total: number;
    pizza_count: number;
    lines: { name: string; quantity: number }[];
    paid: boolean;
    driver_name: string | null;
    created_at: string;
    mins_ago: number;
  }>;

  const state = (await sql`
    SELECT sold_out FROM restaurant_state WHERE id = ${restaurantId} LIMIT 1
  `) as { sold_out: boolean }[];

  const pendingPizzas = pending[0]?.pizzas ?? 0;
  return {
    soldOut: state[0]?.sold_out ?? false,
    pendingCount: pending[0]?.cnt ?? 0,
    pendingPizzas,
    waitMinutes: estimatedWait(base, pendingPizzas),
    soldToday: today[0]?.pizzas ?? 0,
    ordersToday: today[0]?.cnt ?? 0,
    revenueToday: Math.round((today[0]?.revenue ?? 0) * 100) / 100,
    week,
    topProducts: topRows.map((t) => ({ name: t.name, value: t.qty })),
    orders: orderRows.map((o) => ({
      id: o.id,
      status: o.status,
      fulfillment: o.fulfillment,
      customerName: o.customer_name,
      total: o.total,
      pizzaCount: o.pizza_count,
      minsAgo: Math.max(0, Math.round(o.mins_ago)),
      createdAt: o.created_at,
      paid: o.paid,
      driverName: o.driver_name,
      lines: Array.isArray(o.lines) ? o.lines : [],
    })),
  };
}

// -------- Order detail (full) --------
export interface OrderDetail {
  id: string;
  status: string;
  fulfillment: string;
  customerName: string;
  phone: string;
  email: string | null;
  address: {
    street: string;
    houseNumber: string;
    city: string;
    zip: string;
  } | null;
  zoneName: string | null;
  lines: CartLine[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  payment: string;
  note: string | null;
  eta: number;
  createdAt: string;
  driverName: string | null;
}

export async function getOrderDetail(
  restaurantId: string,
  id: string
): Promise<OrderDetail | null> {
  await requireAdmin(restaurantId);
  await ensureOrderColumns();
  const rows = (await sql`
    SELECT id, status, fulfillment, customer_name, phone, email, address,
           zone_name, lines, subtotal::float AS subtotal,
           delivery_fee::float AS delivery_fee, discount::float AS discount,
           total::float AS total, payment, note, eta, created_at, driver_name
    FROM orders WHERE id = ${id} AND restaurant_id = ${restaurantId} LIMIT 1
  `) as Array<{
    id: string;
    status: string;
    fulfillment: string;
    customer_name: string;
    phone: string;
    email: string | null;
    address: OrderDetail["address"];
    zone_name: string | null;
    lines: CartLine[];
    subtotal: number;
    delivery_fee: number;
    discount: number;
    total: number;
    payment: string;
    note: string | null;
    eta: number;
    created_at: string;
    driver_name: string | null;
  }>;
  const o = rows[0];
  if (!o) return null;
  return {
    id: o.id,
    status: o.status,
    fulfillment: o.fulfillment,
    customerName: o.customer_name,
    phone: o.phone,
    email: o.email,
    address: o.address ?? null,
    zoneName: o.zone_name,
    lines: Array.isArray(o.lines) ? o.lines : [],
    subtotal: o.subtotal,
    deliveryFee: o.delivery_fee,
    discount: o.discount,
    total: o.total,
    payment: o.payment,
    note: o.note,
    eta: o.eta,
    createdAt: o.created_at,
    driverName: o.driver_name,
  };
}

export async function setSoldOut(restaurantId: string, value: boolean) {
  const session = await requireAdmin(restaurantId);
  await sql`
    UPDATE restaurant_state SET sold_out = ${value}, updated_at = now()
    WHERE id = ${restaurantId}
  `;
  await audit({
    action: "restaurant.sold_out",
    actorId: session.user.id,
    actorEmail: session.user.email,
    restaurantId,
    meta: { value },
  });
  return { ok: true };
}

const ALLOWED_STATUSES = [
  "received",
  "accepted",
  "preparing",
  "ready",
  "delivering",
  "delivered",
  "cancelled",
];

export async function setOrderStatus(
  restaurantId: string,
  id: string,
  status: string
) {
  const session = await requireAdmin(restaurantId);
  if (!ALLOWED_STATUSES.includes(status))
    return { ok: false, error: "Neplatný stav." };
  await sql`
    UPDATE orders SET status = ${status}
    WHERE id = ${id} AND restaurant_id = ${restaurantId}
  `;
  await audit({
    action: "order.status_changed",
    actorId: session.user.id,
    actorEmail: session.user.email,
    restaurantId,
    target: id,
    meta: { status },
  });
  return { ok: true };
}

// ===========================================================================
// Daily open • availability • staff shifts
// ---------------------------------------------------------------------------
// Each day the pizzeria is opened manually: ~1h before opening a green button
// appears in the admin. Opening asks which menu items are unavailable today
// (they vanish from the site; the list resets at 12:00) and which staff have a
// shift (only they can work that day; the shift is logged). Prune of old orders
// lives here too.
// ===========================================================================

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Current weekday (0 = Monday … 6 = Sunday) and minutes-since-midnight in the
// Europe/Bratislava timezone, matching the seed opening-hours format.
function bratislavaNow(): { weekdayIdx: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Bratislava",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Monday";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const min = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const map: Record<string, number> = {
    Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3,
    Friday: 4, Saturday: 5, Sunday: 6,
  };
  return { weekdayIdx: map[wd] ?? 0, minutes: hour * 60 + min };
}

export interface ServiceStatus {
  serviceDate: string;
  open: boolean; // opened for today's service day
  canOpenNow: boolean; // within the 1h-before-open window and not open yet
  openTime: string | null;
  closedToday: boolean; // today is a non-opening day
}

export async function getServiceStatus(
  restaurantId: string
): Promise<ServiceStatus> {
  await requireAdmin(restaurantId);
  await ensureOrderColumns();
  const rows = (await sql.query(
    `SELECT COALESCE(open_date = ${SERVICE_DATE}, false) AS is_open,
            (${SERVICE_DATE})::text AS svc
     FROM restaurant_state WHERE id = $1 LIMIT 1`,
    [restaurantId]
  )) as { is_open: boolean; svc: string }[];
  const open = rows[0]?.is_open ?? false;
  const serviceDate = rows[0]?.svc ?? "";

  const { weekdayIdx, minutes } = bratislavaNow();
  const r = RESTAURANTS.find((x) => x.id === restaurantId);
  const today = r?.openingHours.find((h) => h.day === weekdayIdx);
  const closedToday = !today || today.closed === true;
  let canOpenNow = false;
  let openTime: string | null = null;
  if (!closedToday && today) {
    openTime = today.open;
    canOpenNow =
      !open &&
      minutes >= toMinutes(today.open) - 60 &&
      minutes < toMinutes(today.close);
  }
  return { serviceDate, open, canOpenNow, openTime, closedToday };
}

export interface OpenPrep {
  products: { id: string; name: string; category: string; unavailable: boolean }[];
  staff: { id: string; name: string; role: string; onShift: boolean }[];
}

export async function getOpenPrep(restaurantId: string): Promise<OpenPrep> {
  await requireAdmin(restaurantId);
  await ensureContent();
  await ensureOrderColumns();
  const prodRows = (await sql`
    SELECT id, name, category FROM products
    WHERE restaurant_id = 'all' AND category <> 'drinks'
    ORDER BY sort, name`) as { id: string; name: string; category: string }[];
  const unav = (await sql.query(
    `SELECT product_id FROM daily_unavailable
     WHERE restaurant_id = $1 AND service_date = ${SERVICE_DATE}`,
    [restaurantId]
  )) as { product_id: string }[];
  const unavSet = new Set(unav.map((u) => u.product_id));
  const staffRows = (await sql`
    SELECT id, name, role FROM users
    WHERE restaurant_id = ${restaurantId} AND role IN ('driver', 'kuchar')
    ORDER BY role, name`) as { id: string; name: string; role: string }[];
  const shiftRows = (await sql.query(
    `SELECT user_id FROM shifts
     WHERE restaurant_id = $1 AND service_date = ${SERVICE_DATE}`,
    [restaurantId]
  )) as { user_id: string }[];
  const shiftSet = new Set(shiftRows.map((s) => s.user_id));
  return {
    products: prodRows.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      unavailable: unavSet.has(p.id),
    })),
    staff: staffRows.map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      onShift: shiftSet.has(s.id),
    })),
  };
}

export async function openRestaurant(
  restaurantId: string,
  unavailableIds: string[],
  shiftUserIds: string[]
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdmin(restaurantId);
  await ensureOrderColumns();
  // Mark open for today's service day.
  await sql.query(
    `UPDATE restaurant_state SET open_date = ${SERVICE_DATE}, updated_at = now()
     WHERE id = $1`,
    [restaurantId]
  );
  // Replace today's unavailable set.
  await sql.query(
    `DELETE FROM daily_unavailable
     WHERE restaurant_id = $1 AND service_date = ${SERVICE_DATE}`,
    [restaurantId]
  );
  for (const pid of unavailableIds.slice(0, 500)) {
    await sql.query(
      `INSERT INTO daily_unavailable (restaurant_id, product_id, service_date)
       VALUES ($1, $2, ${SERVICE_DATE}) ON CONFLICT DO NOTHING`,
      [restaurantId, pid]
    );
  }
  // Replace today's shift set.
  await sql.query(
    `DELETE FROM shifts WHERE restaurant_id = $1 AND service_date = ${SERVICE_DATE}`,
    [restaurantId]
  );
  if (shiftUserIds.length) {
    const staff = (await sql.query(
      `SELECT id::text AS id, name, role FROM users
       WHERE id::text = ANY($1::text[]) AND restaurant_id = $2`,
      [shiftUserIds, restaurantId]
    )) as { id: string; name: string; role: string }[];
    for (const s of staff) {
      await sql.query(
        `INSERT INTO shifts (id, restaurant_id, user_id, name, role, service_date)
         VALUES ($1, $2, $3, $4, $5, ${SERVICE_DATE})
         ON CONFLICT (restaurant_id, user_id, service_date) DO NOTHING`,
        [shortId(), restaurantId, s.id, s.name, s.role]
      );
    }
  }
  await audit({
    action: "restaurant.opened",
    actorId: session.user.id,
    actorEmail: session.user.email,
    restaurantId,
    meta: { unavailable: unavailableIds.length, shift: shiftUserIds.length },
  });
  return { ok: true };
}

// Close the pizzeria for the day again (clears the manual open flag).
export async function closeRestaurant(
  restaurantId: string
): Promise<{ ok: boolean }> {
  const session = await requireAdmin(restaurantId);
  await ensureOrderColumns();
  await sql`
    UPDATE restaurant_state SET open_date = NULL, updated_at = now()
    WHERE id = ${restaurantId}
  `;
  await audit({
    action: "restaurant.closed",
    actorId: session.user.id,
    actorEmail: session.user.email,
    restaurantId,
  });
  return { ok: true };
}

// Whether a staff member has a shift for today's service day (admins always do).
async function hasShiftToday(
  restaurantId: string,
  userId: string
): Promise<boolean> {
  const rows = (await sql.query(
    `SELECT 1 FROM shifts
     WHERE restaurant_id = $1 AND user_id = $2 AND service_date = ${SERVICE_DATE}
     LIMIT 1`,
    [restaurantId, userId]
  )) as unknown[];
  return rows.length > 0;
}

// Prune orders older than two weeks (admin housekeeping; confirmed in the UI).
export async function resetOldOrders(
  restaurantId: string
): Promise<{ ok: boolean; deleted: number }> {
  const session = await requireAdmin(restaurantId);
  const rows = (await sql`
    DELETE FROM orders
    WHERE restaurant_id = ${restaurantId}
      AND created_at < now() - interval '14 days'
    RETURNING id`) as { id: string }[];
  await audit({
    action: "orders.pruned",
    actorId: session.user.id,
    actorEmail: session.user.email,
    restaurantId,
    meta: { deleted: rows.length },
  });
  return { ok: true, deleted: rows.length };
}

export interface ShiftDay {
  serviceDate: string;
  staff: string[];
  orders: number;
  revenue: number;
}

// Who worked which days + the orders/revenue booked on each of those days.
export async function getShiftsReport(
  restaurantId: string
): Promise<ShiftDay[]> {
  await requireAdmin(restaurantId);
  await ensureOrderColumns();
  const shiftRows = (await sql`
    SELECT service_date::text AS d, array_agg(name ORDER BY name) AS staff
    FROM shifts WHERE restaurant_id = ${restaurantId}
    GROUP BY service_date ORDER BY service_date DESC LIMIT 21`) as {
    d: string;
    staff: string[];
  }[];
  const orderRows = (await sql.query(
    `SELECT (((created_at AT TIME ZONE 'Europe/Bratislava') - interval '12 hours')::date)::text AS d,
            COUNT(*)::int AS n, COALESCE(SUM(total), 0)::float AS rev
     FROM orders WHERE restaurant_id = $1 AND status <> 'cancelled'
     GROUP BY 1`,
    [restaurantId]
  )) as { d: string; n: number; rev: number }[];
  const byDate = new Map(orderRows.map((o) => [o.d, o]));
  return shiftRows.map((s) => ({
    serviceDate: s.d,
    staff: Array.isArray(s.staff) ? s.staff : [],
    orders: byDate.get(s.d)?.n ?? 0,
    revenue: Math.round((byDate.get(s.d)?.rev ?? 0) * 100) / 100,
  }));
}

// ===========================================================================
// Admin content management (products / coupons / zones) — persisted to DB
// ===========================================================================

// -------- Products --------
export async function adminGetProducts(
  restaurantId: string
): Promise<Product[]> {
  await requireAdmin(restaurantId);
  await ensureContent();
  // Single shared menu (restaurant_id 'all') — the same for both pizzerias.
  const rows = (await sql`
    SELECT id, restaurant_id, category, name, description, image, base_price,
           sizes, ingredients, allergens, badges, available
    FROM products WHERE restaurant_id = 'all' AND category <> 'drinks'
    ORDER BY sort, name
  `) as ProductRow[];
  return rows.map(rowToProduct);
}

export interface ProductInput {
  id?: string;
  category: CategoryId;
  name: string;
  description: string;
  image: string;
  basePrice: number;
  weight: string;
  ingredients: string[];
  allergens: string[];
  badges: Badge[];
  available: boolean;
}

export async function saveProduct(
  restaurantId: string,
  input: ProductInput
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const session = await requireAdmin(restaurantId);
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Zadajte názov produktu." };
  try {
    await ensureContent();
    const price = Math.max(0, round2(Number(input.basePrice) || 0));
    const sizes: ProductSize[] = [
      { id: "std", label: input.weight.trim() || "1 ks", priceDelta: 0 },
    ];
    // Shared menu: one row for both pizzerias (restaurant_id 'all').
    const id = input.id ?? shortId().toLowerCase();

    await sql`
      INSERT INTO products (id, restaurant_id, category, name, description, image,
        base_price, sizes, ingredients, allergens, badges, available, updated_at)
      VALUES (${id}, 'all', ${input.category}, ${name},
        ${input.description}, ${input.image}, ${price},
        ${JSON.stringify(sizes)}, ${JSON.stringify(input.ingredients)},
        ${JSON.stringify(input.allergens)}, ${JSON.stringify(input.badges)},
        ${input.available}, now())
      ON CONFLICT (id) DO UPDATE SET
        restaurant_id = 'all',
        category = EXCLUDED.category, name = EXCLUDED.name,
        description = EXCLUDED.description, image = EXCLUDED.image,
        base_price = EXCLUDED.base_price, sizes = EXCLUDED.sizes,
        ingredients = EXCLUDED.ingredients, allergens = EXCLUDED.allergens,
        badges = EXCLUDED.badges, available = EXCLUDED.available,
        updated_at = now()
    `;
    await audit({
      action: "product.saved",
      actorId: session.user.id,
      actorEmail: session.user.email,
      restaurantId,
      target: id,
    });
    return { ok: true, id };
  } catch (e) {
    console.error("saveProduct failed", e);
    return { ok: false, error: "Produkt sa nepodarilo uložiť." };
  }
}

export async function setProductAvailable(
  restaurantId: string,
  id: string,
  available: boolean
): Promise<{ ok: boolean }> {
  await requireAdmin(restaurantId);
  await sql`
    UPDATE products SET available = ${available}, updated_at = now()
    WHERE id = ${id} AND restaurant_id = 'all'
  `;
  return { ok: true };
}

export async function deleteProduct(
  restaurantId: string,
  id: string
): Promise<{ ok: boolean }> {
  const session = await requireAdmin(restaurantId);
  await sql`DELETE FROM products WHERE id = ${id} AND restaurant_id = 'all'`;
  await audit({
    action: "product.deleted",
    actorId: session.user.id,
    actorEmail: session.user.email,
    restaurantId,
    target: id,
  });
  return { ok: true };
}

// -------- Coupons --------
export async function adminGetCoupons(
  restaurantId: string
): Promise<Coupon[]> {
  await requireAdmin(restaurantId);
  await ensureContent();
  const rows = (await sql`
    SELECT code, restaurant_id, type, value, min_subtotal, label
    FROM coupons WHERE restaurant_id IN ('all', ${restaurantId})
    ORDER BY created_at DESC
  `) as CouponRow[];
  return rows.map(rowToCoupon);
}

export async function createCoupon(
  restaurantId: string,
  input: {
    code: string;
    type: "percentage" | "fixed" | "free_delivery";
    value: number;
    minSubtotal: number;
    label: string;
    forAll: boolean;
  }
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdmin(restaurantId);
  await ensureContent();
  const code = input.code.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9]{3,40}$/.test(code))
    return { ok: false, error: "Kód: 3–40 znakov (písmená/čísla)." };
  const existing = (await sql`SELECT 1 FROM coupons WHERE code = ${code} LIMIT 1`) as unknown[];
  if (existing.length) return { ok: false, error: "Kupón s týmto kódom už existuje." };
  const owner = input.forAll ? "all" : restaurantId;
  await sql`
    INSERT INTO coupons (code, restaurant_id, type, value, min_subtotal, label)
    VALUES (${code}, ${owner}, ${input.type}, ${Math.max(0, input.value)},
      ${Math.max(0, input.minSubtotal)}, ${input.label.trim() || code})
  `;
  await audit({
    action: "coupon.created",
    actorId: session.user.id,
    actorEmail: session.user.email,
    restaurantId,
    target: code,
  });
  return { ok: true };
}

export async function deleteCoupon(
  restaurantId: string,
  code: string
): Promise<{ ok: boolean }> {
  const session = await requireAdmin(restaurantId);
  // an admin may only delete their own or global coupons
  await sql`
    DELETE FROM coupons
    WHERE code = ${code} AND restaurant_id IN ('all', ${restaurantId})
  `;
  await audit({
    action: "coupon.deleted",
    actorId: session.user.id,
    actorEmail: session.user.email,
    restaurantId,
    target: code,
  });
  return { ok: true };
}

// Bulk-save the coupons visible to this admin (its own + global "all" coupons)
// in one shot — upsert everything provided and delete anything removed. Mirrors
// saveZones so the coupons UI can offer one Save button + revert.
export interface CouponInput {
  code: string;
  type: "percentage" | "fixed" | "free_delivery";
  value: number;
  minSubtotal: number;
  label: string;
  forAll: boolean;
}

export async function saveCoupons(
  restaurantId: string,
  coupons: CouponInput[]
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdmin(restaurantId);
  await ensureContent();

  const norm: {
    code: string;
    owner: string;
    type: string;
    value: number;
    minSubtotal: number;
    label: string;
  }[] = [];
  const seen = new Set<string>();
  for (const c of coupons) {
    const code = c.code.trim().toUpperCase().replace(/\s+/g, "");
    if (!/^[A-Z0-9]{3,40}$/.test(code))
      return {
        ok: false,
        error: `Neplatný kód „${c.code}“ — 3–40 znakov (písmená/čísla).`,
      };
    if (seen.has(code))
      return { ok: false, error: `Duplicitný kód kupónu: ${code}.` };
    seen.add(code);
    norm.push({
      code,
      owner: c.forAll ? "all" : restaurantId,
      type: c.type,
      value: Math.max(0, c.value),
      minSubtotal: Math.max(0, c.minSubtotal),
      label: c.label.trim() || code,
    });
  }

  // Never clobber a coupon that belongs to the *other* restaurant.
  for (const c of norm) {
    const conflict = (await sql`
      SELECT restaurant_id FROM coupons WHERE code = ${c.code} LIMIT 1
    `) as { restaurant_id: string }[];
    const owner = conflict[0]?.restaurant_id;
    if (owner && owner !== "all" && owner !== restaurantId)
      return { ok: false, error: `Kód ${c.code} patrí inej prevádzke.` };
  }

  // Delete coupons in this admin's scope that were removed in the editor.
  const codes = norm.map((c) => c.code);
  if (codes.length)
    await sql.query(
      `DELETE FROM coupons WHERE restaurant_id IN ('all', $1) AND NOT (code = ANY($2::text[]))`,
      [restaurantId, codes]
    );
  else
    await sql`DELETE FROM coupons WHERE restaurant_id IN ('all', ${restaurantId})`;

  for (const c of norm) {
    await sql`
      INSERT INTO coupons (code, restaurant_id, type, value, min_subtotal, label, active)
      VALUES (${c.code}, ${c.owner}, ${c.type}, ${c.value}, ${c.minSubtotal}, ${c.label}, true)
      ON CONFLICT (code) DO UPDATE SET
        restaurant_id = EXCLUDED.restaurant_id,
        type = EXCLUDED.type,
        value = EXCLUDED.value,
        min_subtotal = EXCLUDED.min_subtotal,
        label = EXCLUDED.label,
        active = true
    `;
  }

  await audit({
    action: "coupons.saved",
    actorId: session.user.id,
    actorEmail: session.user.email,
    restaurantId,
    meta: { count: norm.length },
  });
  return { ok: true };
}

// -------- Delivery zones --------
export async function adminGetZones(
  restaurantId: string
): Promise<DeliveryZone[]> {
  await requireAdmin(restaurantId);
  await ensureContent();
  const rows = (await sql`
    SELECT id, restaurant_id, name, minimum_order, delivery_fee,
           estimated_minutes, areas
    FROM delivery_zones WHERE restaurant_id = ${restaurantId} ORDER BY sort
  `) as ZoneRow[];
  return rows.map(rowToZone);
}

export async function saveZones(
  restaurantId: string,
  zones: DeliveryZone[]
): Promise<{ ok: boolean }> {
  const session = await requireAdmin(restaurantId);
  await ensureContent();
  const ids = zones.map((z) => z.id);
  // remove zones that were deleted in the UI
  if (ids.length) {
    await sql.query(
      `DELETE FROM delivery_zones WHERE restaurant_id = $1 AND NOT (id = ANY($2::text[]))`,
      [restaurantId, ids]
    );
  } else {
    await sql`DELETE FROM delivery_zones WHERE restaurant_id = ${restaurantId}`;
  }
  let i = 0;
  for (const z of zones) {
    await sql`
      INSERT INTO delivery_zones (id, restaurant_id, name, minimum_order,
        delivery_fee, estimated_minutes, areas, sort)
      VALUES (${z.id}, ${restaurantId}, ${z.name}, ${Math.max(0, z.minimumOrder)},
        ${Math.max(0, z.deliveryFee)}, ${Math.max(5, z.estimatedMinutes)},
        ${JSON.stringify(z.areas)}, ${i++})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, minimum_order = EXCLUDED.minimum_order,
        delivery_fee = EXCLUDED.delivery_fee,
        estimated_minutes = EXCLUDED.estimated_minutes,
        areas = EXCLUDED.areas, sort = EXCLUDED.sort
    `;
  }
  await audit({
    action: "zones.saved",
    actorId: session.user.id,
    actorEmail: session.user.email,
    restaurantId,
    meta: { count: zones.length },
  });
  return { ok: true };
}

// ===========================================================================
// Customer-facing order status (used by the /track page) — no auth: the short
// order id is the shareable secret, same as a courier tracking link.
// ===========================================================================
export interface PublicOrderStatus {
  id: string;
  restaurantId: string;
  status: string;
  fulfillment: string;
  paid: boolean;
  total: number;
  eta: number;
  paidAgoSec: number | null; // seconds since payment (null if not paid)
}

export async function getOrderStatus(
  id: string
): Promise<PublicOrderStatus | null> {
  if (!id) return null;
  try {
    await ensureOrderColumns();
    const rows = (await sql`
      SELECT id, restaurant_id, status, fulfillment,
             COALESCE(paid, false) AS paid, total::float AS total, eta,
             EXTRACT(EPOCH FROM (now() - paid_at)) AS paid_ago
      FROM orders WHERE id = ${id} LIMIT 1
    `) as Array<{
      id: string;
      restaurant_id: string;
      status: string;
      fulfillment: string;
      paid: boolean;
      total: number;
      eta: number;
      paid_ago: number | null;
    }>;
    const o = rows[0];
    if (!o) return null;
    return {
      id: o.id,
      restaurantId: o.restaurant_id,
      status: o.status,
      fulfillment: o.fulfillment,
      paid: o.paid,
      total: o.total,
      eta: o.eta,
      paidAgoSec: o.paid_ago != null ? Math.round(Number(o.paid_ago)) : null,
    };
  } catch {
    return null;
  }
}

// -------- Signed-in customer's order history --------
export interface MyOrderRow {
  id: string;
  restaurantId: string;
  status: string;
  fulfillment: string;
  paid: boolean;
  total: number;
  createdAt: string;
  lines: { name: string; quantity: number }[];
}

export async function getMyOrders(): Promise<MyOrderRow[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  try {
    await ensureOrderColumns();
    const rows = (await sql`
      SELECT id, restaurant_id, status, fulfillment,
             COALESCE(paid, false) AS paid, total::float AS total,
             created_at, lines
      FROM orders WHERE user_id = ${session.user.id}
      ORDER BY created_at DESC LIMIT 40
    `) as Array<{
      id: string;
      restaurant_id: string;
      status: string;
      fulfillment: string;
      paid: boolean;
      total: number;
      created_at: string;
      lines: { name: string; quantity: number }[];
    }>;
    return rows.map((o) => ({
      id: o.id,
      restaurantId: o.restaurant_id,
      status: o.status,
      fulfillment: o.fulfillment,
      paid: o.paid,
      total: o.total,
      createdAt: o.created_at,
      lines: Array.isArray(o.lines) ? o.lines : [],
    }));
  } catch {
    return [];
  }
}

// ---- Saved customer profile (only for signed-in customers) ----
let profileColsPromise: Promise<void> | null = null;
async function ensureUserProfileColumns(): Promise<void> {
  if (profileColsPromise) return profileColsPromise;
  profileColsPromise = (async () => {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS address jsonb`;
  })().catch((e) => {
    profileColsPromise = null;
    throw e;
  });
  return profileColsPromise;
}

export interface CustomerProfile {
  loggedIn: boolean;
  name: string;
  phone: string;
  email: string;
  address: { street: string; houseNumber: string; city: string; zip: string } | null;
}

// The signed-in customer's saved details, used to pre-fill checkout. Returns
// loggedIn:false when nobody is signed in on this device.
export async function getCustomerProfile(): Promise<CustomerProfile> {
  const empty: CustomerProfile = {
    loggedIn: false,
    name: "",
    phone: "",
    email: "",
    address: null,
  };
  const session = await auth();
  if (!session?.user?.id) return empty;
  try {
    await ensureUserProfileColumns();
    const rows = (await sql`
      SELECT name, email, phone, address FROM users WHERE id = ${session.user.id} LIMIT 1
    `) as {
      name: string;
      email: string;
      phone: string | null;
      address: CustomerProfile["address"];
    }[];
    const u = rows[0];
    return {
      loggedIn: true,
      name: u?.name ?? session.user.name ?? "",
      email: u?.email ?? session.user.email ?? "",
      phone: u?.phone ?? "",
      address: u?.address ?? null,
    };
  } catch {
    return { ...empty, loggedIn: true };
  }
}

// Persist the customer's default order details to their account (Neon). Only
// works when signed in — a logged-out order is never attached to an account.
export async function saveCustomerProfile(input: {
  name: string;
  phone: string;
  address?: { street: string; houseNumber: string; city: string; zip: string };
}): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  try {
    await ensureUserProfileColumns();
    await sql`
      UPDATE users
      SET name = ${input.name.trim() || session.user.name || ""},
          phone = ${input.phone.trim() || null},
          address = ${input.address ? JSON.stringify(input.address) : null}
      WHERE id = ${session.user.id}
    `;
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

// ===========================================================================
// Delivery dispatch — drivers ("brigádnici") and admins.
// Orders appear here only once the kitchen marks them `ready`. Drivers claim
// an order, navigate (Mapy.cz), call the customer, then mark it paid — which
// finalises it (delivered + paid) and drops it off the board shortly after.
// ===========================================================================

// Guard: a dispatcher is a driver, admin or super_admin bound to a restaurant.
async function requireDispatcher(): Promise<{
  userId: string;
  name: string;
  email: string | null;
  role: string;
  restaurantId: string;
}> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = session.user.role;
  if (role !== "driver" && role !== "admin" && role !== "super_admin")
    throw new Error("Unauthorized");
  if (!session.user.restaurantId) throw new Error("Forbidden");
  const current = await getSessionVersion(session.user.id);
  if (current !== null && current !== session.user.sessionVersion)
    throw new Error("Session revoked");
  return {
    userId: session.user.id,
    name: session.user.name ?? "Kuriér",
    email: session.user.email ?? null,
    role,
    restaurantId: session.user.restaurantId,
  };
}

export interface DispatchOrder {
  id: string;
  status: string;
  fulfillment: string;
  customerName: string;
  phone: string;
  address: CustomerAddressLike | null;
  zoneName: string | null;
  total: number;
  payment: string;
  note: string | null;
  driverId: string | null;
  driverName: string | null;
  paid: boolean;
  minsAgo: number;
  lines: { name: string; quantity: number }[];
}

type CustomerAddressLike = {
  street: string;
  houseNumber: string;
  city: string;
  zip: string;
};

export interface DispatchContext {
  role: string;
  name: string;
  restaurantId: string;
  restaurantName: string;
  restaurantAddress: string;
  userId: string;
  onShift: boolean; // false for a driver with no shift today
}

export async function getDispatchContext(): Promise<DispatchContext | null> {
  const session = await auth();
  const role = session?.user?.role;
  if (
    !session?.user ||
    (role !== "driver" && role !== "admin" && role !== "super_admin") ||
    !session.user.restaurantId
  )
    return null;
  const r = RESTAURANTS.find((x) => x.id === session.user.restaurantId);
  const isStaffAdmin = role === "admin" || role === "super_admin";
  const onShift = isStaffAdmin
    ? true
    : await hasShiftToday(session.user.restaurantId, session.user.id).catch(
        () => false
      );
  return {
    role: role!,
    name: session.user.name ?? "Kuriér",
    restaurantId: session.user.restaurantId,
    restaurantName: r?.name ?? "Prevádzka",
    restaurantAddress: r?.address ?? "",
    userId: session.user.id,
    onShift,
  };
}

// The dispatch board: orders the kitchen has finished (`ready`) or that are
// already on the way (`delivering`), plus just-paid ones kept for a short
// grace window so the driver sees the confirmation before they disappear.
export async function getDispatchBoard(): Promise<DispatchOrder[]> {
  const ctx = await requireDispatcher();
  await ensureOrderColumns();
  const rows = (await sql`
    SELECT id, status, fulfillment, customer_name, phone, address, zone_name,
           total::float AS total, payment, note, driver_id, driver_name,
           COALESCE(paid, false) AS paid, lines,
           EXTRACT(EPOCH FROM (now() - created_at))/60 AS mins_ago
    FROM orders
    WHERE restaurant_id = ${ctx.restaurantId}
      AND fulfillment = 'delivery'
      AND (
        status IN ('ready', 'delivering')
        OR (COALESCE(paid, false) = true
            AND paid_at > now() - interval '3 minutes')
      )
    ORDER BY
      CASE WHEN COALESCE(paid, false) THEN 1 ELSE 0 END,
      created_at ASC
  `) as Array<{
    id: string;
    status: string;
    fulfillment: string;
    customer_name: string;
    phone: string;
    address: CustomerAddressLike | null;
    zone_name: string | null;
    total: number;
    payment: string;
    note: string | null;
    driver_id: string | null;
    driver_name: string | null;
    paid: boolean;
    lines: { name: string; quantity: number }[];
    mins_ago: number;
  }>;
  return rows.map((o) => ({
    id: o.id,
    status: o.status,
    fulfillment: o.fulfillment,
    customerName: o.customer_name,
    phone: o.phone,
    address: o.address ?? null,
    zoneName: o.zone_name,
    total: o.total,
    payment: o.payment,
    note: o.note,
    driverId: o.driver_id,
    driverName: o.driver_name,
    paid: o.paid,
    minsAgo: Math.max(0, Math.round(o.mins_ago)),
    lines: Array.isArray(o.lines) ? o.lines : [],
  }));
}

// Claim an unassigned order (atomic: only succeeds if nobody else has it).
export async function claimDispatchOrder(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireDispatcher();
  await ensureOrderColumns();
  const rows = (await sql`
    UPDATE orders SET driver_id = ${ctx.userId}, driver_name = ${ctx.name}
    WHERE id = ${id} AND restaurant_id = ${ctx.restaurantId}
      AND driver_id IS NULL
    RETURNING id
  `) as { id: string }[];
  if (!rows.length)
    return { ok: false, error: "Objednávku už prevzal iný kuriér." };
  await audit({
    action: "dispatch.claimed",
    actorId: ctx.userId,
    actorEmail: ctx.email,
    restaurantId: ctx.restaurantId,
    target: id,
  });
  return { ok: true };
}

// Release an order the current dispatcher holds (admins can release any).
export async function releaseDispatchOrder(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireDispatcher();
  await ensureOrderColumns();
  const isAdmin = ctx.role === "admin" || ctx.role === "super_admin";
  const rows = isAdmin
    ? ((await sql`
        UPDATE orders SET driver_id = NULL, driver_name = NULL
        WHERE id = ${id} AND restaurant_id = ${ctx.restaurantId}
          AND COALESCE(paid, false) = false
        RETURNING id`) as { id: string }[])
    : ((await sql`
        UPDATE orders SET driver_id = NULL, driver_name = NULL
        WHERE id = ${id} AND restaurant_id = ${ctx.restaurantId}
          AND driver_id = ${ctx.userId} AND COALESCE(paid, false) = false
        RETURNING id`) as { id: string }[]);
  if (!rows.length) return { ok: false, error: "Nedá sa uvoľniť." };
  return { ok: true };
}

// Mark an order as on the way. Auto-claims for the current dispatcher if the
// order is still unassigned.
export async function markDispatchDelivering(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireDispatcher();
  await ensureOrderColumns();
  const rows = (await sql`
    UPDATE orders
    SET status = 'delivering',
        driver_id = COALESCE(driver_id, ${ctx.userId}),
        driver_name = COALESCE(driver_name, ${ctx.name})
    WHERE id = ${id} AND restaurant_id = ${ctx.restaurantId}
      AND status IN ('ready', 'delivering')
    RETURNING id
  `) as { id: string }[];
  if (!rows.length) return { ok: false, error: "Nedá sa aktualizovať." };
  await audit({
    action: "dispatch.delivering",
    actorId: ctx.userId,
    actorEmail: ctx.email,
    restaurantId: ctx.restaurantId,
    target: id,
  });
  return { ok: true };
}

// Mark the order paid — the terminal step. Finalises it as delivered + paid.
// A driver may only settle an order assigned to them; admins may settle any
// (covers pickups when no courier is present).
export async function markDispatchPaid(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireDispatcher();
  await ensureOrderColumns();
  const isAdmin = ctx.role === "admin" || ctx.role === "super_admin";
  const rows = isAdmin
    ? ((await sql`
        UPDATE orders
        SET paid = true, paid_at = now(), status = 'delivered',
            driver_id = COALESCE(driver_id, ${ctx.userId}),
            driver_name = COALESCE(driver_name, ${ctx.name})
        WHERE id = ${id} AND restaurant_id = ${ctx.restaurantId}
          AND COALESCE(paid, false) = false
        RETURNING id`) as { id: string }[])
    : ((await sql`
        UPDATE orders
        SET paid = true, paid_at = now(), status = 'delivered'
        WHERE id = ${id} AND restaurant_id = ${ctx.restaurantId}
          AND driver_id = ${ctx.userId} AND COALESCE(paid, false) = false
        RETURNING id`) as { id: string }[]);
  if (!rows.length)
    return {
      ok: false,
      error: "Objednávku môže ako zaplatenú označiť len jej kuriér.",
    };
  await audit({
    action: "dispatch.paid",
    actorId: ctx.userId,
    actorEmail: ctx.email,
    restaurantId: ctx.restaurantId,
    target: id,
    meta: { role: ctx.role },
  });
  return { ok: true };
}

// ===========================================================================
// Kitchen (KDS) + counter handover
// ---------------------------------------------------------------------------
// Split of duties:
//  • cooks ("kuchár") and admins advance an order through prep (received →
//    preparing → ready) and may pull a not-yet-taken order back into prep. The
//    admin UI confirms each step to avoid mis-taps. Neither takes payment here.
//  • admins run the counter handover ("výdaj") for pickup orders — they mark
//    them paid, which finalises them.
//  • delivery orders go to the driver board once ready; pickups appear on the
//    admin handover panel.
// ===========================================================================

// Guard for reading the kitchen board: cooks + admins.
async function requireKitchen(): Promise<{
  userId: string;
  name: string;
  role: string;
  restaurantId: string;
}> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = session.user.role;
  if (role !== "kuchar" && role !== "admin" && role !== "super_admin")
    throw new Error("Unauthorized");
  if (!session.user.restaurantId) throw new Error("Forbidden");
  const current = await getSessionVersion(session.user.id);
  if (current !== null && current !== session.user.sessionVersion)
    throw new Error("Session revoked");
  return {
    userId: session.user.id,
    name: session.user.name ?? "Kuchár",
    role,
    restaurantId: session.user.restaurantId,
  };
}

export interface KitchenOrder {
  id: string;
  status: string;
  fulfillment: string;
  customerName: string;
  total: number;
  minsAgo: number;
  createdAt: string; // ISO — kitchen is ordered by this (FIFO) + shows the time
  taken: boolean; // claimed by a driver / already paid
  note: string | null;
  lines: { name: string; quantity: number }[];
}

export interface KitchenContext {
  role: string;
  name: string;
  restaurantId: string;
  restaurantName: string;
  userId: string;
  onShift: boolean; // false for a cook with no shift today
}

export async function getKitchenContext(): Promise<KitchenContext | null> {
  const session = await auth();
  const role = session?.user?.role;
  if (
    !session?.user ||
    (role !== "kuchar" && role !== "admin" && role !== "super_admin") ||
    !session.user.restaurantId
  )
    return null;
  const r = RESTAURANTS.find((x) => x.id === session.user.restaurantId);
  const onShift =
    role === "admin" || role === "super_admin"
      ? true
      : await hasShiftToday(session.user.restaurantId, session.user.id).catch(
          () => false
        );
  return {
    role: role!,
    name: session.user.name ?? "Kuchár",
    restaurantId: session.user.restaurantId,
    restaurantName: r?.name ?? "Prevádzka",
    userId: session.user.id,
    onShift,
  };
}

// Orders the kitchen still has to make: everything in prep, plus `ready` orders
// that nobody has taken yet (no driver claimed it, not paid) — so a cook can
// still pull them back if something was wrong.
export async function getKitchenBoard(): Promise<KitchenOrder[]> {
  const ctx = await requireKitchen();
  await ensureOrderColumns();
  const rows = (await sql`
    SELECT id, status, fulfillment, customer_name, total::float AS total, note,
           lines, driver_id, COALESCE(paid, false) AS paid, created_at,
           EXTRACT(EPOCH FROM (now() - created_at))/60 AS mins_ago
    FROM orders
    WHERE restaurant_id = ${ctx.restaurantId}
      AND (
        status IN ('received', 'accepted', 'preparing')
        OR (status = 'ready' AND driver_id IS NULL AND COALESCE(paid, false) = false)
      )
    ORDER BY created_at ASC
  `) as Array<{
    id: string;
    status: string;
    fulfillment: string;
    customer_name: string;
    total: number;
    note: string | null;
    lines: { name: string; quantity: number }[];
    driver_id: string | null;
    paid: boolean;
    created_at: string;
    mins_ago: number;
  }>;
  return rows.map((o) => ({
    id: o.id,
    status: o.status,
    fulfillment: o.fulfillment,
    customerName: o.customer_name,
    total: o.total,
    minsAgo: Math.max(0, Math.round(o.mins_ago)),
    createdAt: o.created_at,
    taken: o.driver_id != null || o.paid,
    note: o.note,
    lines: Array.isArray(o.lines) ? o.lines : [],
  }));
}

// Cook advances an order one step through prep: received/accepted → preparing
// → ready. Never touches delivery/handover.
export async function advanceKitchenOrder(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireKitchen();
  await ensureOrderColumns();
  const rows = (await sql`
    UPDATE orders
    SET status = CASE status
      WHEN 'received' THEN 'preparing'
      WHEN 'accepted' THEN 'preparing'
      WHEN 'preparing' THEN 'ready'
      ELSE status END
    WHERE id = ${id} AND restaurant_id = ${ctx.restaurantId}
      AND status IN ('received', 'accepted', 'preparing')
    RETURNING id
  `) as { id: string }[];
  if (!rows.length) return { ok: false, error: "Objednávku nedá sa posunúť." };
  await audit({
    action: "kitchen.advanced",
    actorId: ctx.userId,
    restaurantId: ctx.restaurantId,
    target: id,
  });
  return { ok: true };
}

// Cook pulls a `ready` order back into prep — only while nobody has taken it
// (no driver claimed it and it isn't paid). Guards a genuine mistake.
export async function returnKitchenOrder(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireKitchen();
  await ensureOrderColumns();
  const rows = (await sql`
    UPDATE orders SET status = 'preparing'
    WHERE id = ${id} AND restaurant_id = ${ctx.restaurantId}
      AND status = 'ready' AND driver_id IS NULL
      AND COALESCE(paid, false) = false
    RETURNING id
  `) as { id: string }[];
  if (!rows.length)
    return {
      ok: false,
      error: "Nedá sa vrátiť — objednávku už niekto prevzal.",
    };
  await audit({
    action: "kitchen.returned",
    actorId: ctx.userId,
    restaurantId: ctx.restaurantId,
    target: id,
  });
  return { ok: true };
}

// Counter handover board for the admin: pickup orders the kitchen has finished,
// plus just-settled ones kept briefly so the confirmation is visible. Delivery
// orders go to the driver board instead.
export async function getHandoverBoard(): Promise<DispatchOrder[]> {
  const ctx = await requireDispatcher();
  if (ctx.role !== "admin" && ctx.role !== "super_admin")
    throw new Error("Forbidden");
  await ensureOrderColumns();
  const rows = (await sql`
    SELECT id, status, fulfillment, customer_name, phone, address, zone_name,
           total::float AS total, payment, note, driver_id, driver_name,
           COALESCE(paid, false) AS paid, lines,
           EXTRACT(EPOCH FROM (now() - created_at))/60 AS mins_ago
    FROM orders
    WHERE restaurant_id = ${ctx.restaurantId}
      AND fulfillment = 'pickup'
      AND (
        status = 'ready'
        OR (COALESCE(paid, false) = true
            AND paid_at > now() - interval '3 minutes')
      )
    ORDER BY
      CASE WHEN COALESCE(paid, false) THEN 1 ELSE 0 END,
      created_at ASC
  `) as Array<{
    id: string;
    status: string;
    fulfillment: string;
    customer_name: string;
    phone: string;
    address: CustomerAddressLike | null;
    zone_name: string | null;
    total: number;
    payment: string;
    note: string | null;
    driver_id: string | null;
    driver_name: string | null;
    paid: boolean;
    lines: { name: string; quantity: number }[];
    mins_ago: number;
  }>;
  return rows.map((o) => ({
    id: o.id,
    status: o.status,
    fulfillment: o.fulfillment,
    customerName: o.customer_name,
    phone: o.phone,
    address: o.address,
    zoneName: o.zone_name,
    total: o.total,
    payment: o.payment,
    note: o.note,
    driverId: o.driver_id,
    driverName: o.driver_name,
    paid: o.paid,
    minsAgo: Math.max(0, Math.round(o.mins_ago)),
    lines: Array.isArray(o.lines) ? o.lines : [],
  }));
}

// ===========================================================================
// Staff order entry — the primary intake is still by phone, so admins and
// drivers can key an order straight into the system. It flows through the
// kitchen and dispatch exactly like an online order.
// ===========================================================================
export interface StaffOrderInput {
  restaurantId: string;
  fulfillment: "delivery" | "pickup";
  customerName: string;
  phone: string;
  address?: { street: string; houseNumber: string; city: string; zip: string };
  lines: CartLine[];
  note?: string;
}

export async function createStaffOrder(
  input: StaffOrderInput
): Promise<CreateOrderResult> {
  const ctx = await requireDispatcher();
  if (input.restaurantId !== ctx.restaurantId)
    return { ok: false, error: "Nesprávna prevádzka." };

  // Staff key the order themselves — name and phone are optional.
  const phone = (input.phone ?? "").trim();
  const name = (input.customerName ?? "").trim() || phone || "Objednávka";
  if (!Array.isArray(input.lines) || input.lines.length === 0)
    return { ok: false, error: "Pridajte aspoň jednu položku." };

  const restaurant = RESTAURANTS.find((r) => r.id === input.restaurantId);
  if (!restaurant) return { ok: false, error: "Neznáma prevádzka." };

  try {
    await ensureContent();
    await ensureOrderColumns();

    const products = await loadProducts();
    const usableProducts = products.length ? products : PRODUCTS;
    const pizza = pizzaIds(usableProducts);

    const lines: CartLine[] = [];
    for (const l of input.lines) {
      const priced = repriceLine(l as CartLine, usableProducts, input.restaurantId);
      if (!priced)
        return { ok: false, error: "Niektorý produkt už nie je dostupný." };
      lines.push(priced);
    }

    // Best-effort delivery-zone match (staff can deliver anywhere they choose).
    let zone: DeliveryZone | null = null;
    if (input.fulfillment === "delivery" && input.address) {
      const zoneRows = (await sql`
        SELECT id, restaurant_id, name, minimum_order, delivery_fee,
               estimated_minutes, areas
        FROM delivery_zones WHERE restaurant_id = ${input.restaurantId}
        ORDER BY sort`) as ZoneRow[];
      const usable = zoneRows.length
        ? zoneRows.map(rowToZone)
        : restaurant.deliveryZones;
      zone = matchZone(usable, `${input.address.street} ${input.address.city}`);
    }

    const totals = computeTotals(
      lines,
      input.restaurantId,
      zone,
      input.fulfillment,
      null,
      COUPONS
    );

    const pending = (await sql`
      SELECT COALESCE(SUM(pizza_count),0)::int AS p FROM orders
      WHERE restaurant_id = ${input.restaurantId}
        AND status IN ('received','accepted','preparing')
    `) as { p: number }[];
    const wait = estimatedWait(
      restaurant.prepTimeMinutes,
      (pending[0]?.p ?? 0) + pizzaCount(lines, pizza)
    );
    const eta = zone ? Math.max(zone.estimatedMinutes, wait) : wait;

    const id = await nextOrderId();
    const note = input.note?.trim()
      ? `Telefón: ${input.note.trim()}`
      : "Telefonická objednávka";
    await sql`
      INSERT INTO orders (
        id, restaurant_id, status, fulfillment, customer_name, phone, email,
        address, zone_name, lines, pizza_count, subtotal, delivery_fee,
        discount, total, payment, note, eta, user_id
      ) VALUES (
        ${id}, ${input.restaurantId}, 'received', ${input.fulfillment},
        ${name}, ${phone}, ${null},
        ${input.address ? JSON.stringify(input.address) : null},
        ${zone?.name ?? null}, ${JSON.stringify(lines)},
        ${pizzaCount(lines, pizza)},
        ${totals.subtotal}, ${totals.deliveryFee}, ${totals.discount},
        ${totals.total},
        ${input.fulfillment === "delivery" ? "Platba pri doručení" : "Platba pri odbere"},
        ${note}, ${eta}, ${null}
      )
    `;
    await audit({
      action: "order.staff_created",
      actorId: ctx.userId,
      actorEmail: ctx.email,
      restaurantId: input.restaurantId,
      target: id,
      meta: { total: totals.total, fulfillment: input.fulfillment, role: ctx.role },
    });
    return { ok: true, id, total: totals.total, eta };
  } catch (e) {
    console.error("createStaffOrder failed", e);
    return { ok: false, error: "Objednávku sa nepodarilo uložiť." };
  }
}

// -------- Edit an existing order (dispatcher / admin) --------
export interface EditableOrder {
  id: string;
  fulfillment: "delivery" | "pickup";
  customerName: string;
  phone: string;
  address: string;
  note: string;
  paid: boolean;
  items: { productId: string; quantity: number }[];
}

export async function getEditableOrder(
  id: string
): Promise<EditableOrder | null> {
  const ctx = await requireDispatcher();
  await ensureOrderColumns();
  const rows = (await sql`
    SELECT id, fulfillment, customer_name, phone, address, note, lines,
           COALESCE(paid, false) AS paid
    FROM orders WHERE id = ${id} AND restaurant_id = ${ctx.restaurantId} LIMIT 1
  `) as Array<{
    id: string;
    fulfillment: string;
    customer_name: string;
    phone: string;
    address: CustomerAddressLike | null;
    note: string | null;
    lines: CartLine[];
    paid: boolean;
  }>;
  const o = rows[0];
  if (!o) return null;

  const agg: Record<string, number> = {};
  for (const l of Array.isArray(o.lines) ? o.lines : [])
    agg[l.productId] = (agg[l.productId] ?? 0) + l.quantity;

  let note = o.note ?? "";
  if (note === "Telefonická objednávka") note = "";
  else if (note.startsWith("Telefón: ")) note = note.slice("Telefón: ".length);

  return {
    id: o.id,
    fulfillment: o.fulfillment === "delivery" ? "delivery" : "pickup",
    customerName: o.customer_name,
    phone: o.phone ?? "",
    address: formatAddress(o.address),
    note,
    paid: o.paid,
    items: Object.entries(agg).map(([productId, quantity]) => ({
      productId,
      quantity,
    })),
  };
}

export async function updateStaffOrder(
  id: string,
  input: StaffOrderInput
): Promise<CreateOrderResult> {
  const ctx = await requireDispatcher();
  if (input.restaurantId !== ctx.restaurantId)
    return { ok: false, error: "Nesprávna prevádzka." };
  if (!Array.isArray(input.lines) || input.lines.length === 0)
    return { ok: false, error: "Objednávka musí mať aspoň jednu položku." };

  try {
    await ensureContent();
    await ensureOrderColumns();
    const isAdmin = ctx.role === "admin" || ctx.role === "super_admin";

    const existing = (await sql`
      SELECT driver_id, COALESCE(paid, false) AS paid
      FROM orders WHERE id = ${id} AND restaurant_id = ${ctx.restaurantId} LIMIT 1
    `) as { driver_id: string | null; paid: boolean }[];
    const ex = existing[0];
    if (!ex) return { ok: false, error: "Objednávka sa nenašla." };
    if (ex.paid)
      return { ok: false, error: "Zaplatenú objednávku nie je možné upraviť." };
    if (!isAdmin && ex.driver_id !== ctx.userId)
      return {
        ok: false,
        error: "Upraviť môžete len objednávku, ktorú máte pridelenú.",
      };

    const products = await loadProducts();
    const usable = products.length ? products : PRODUCTS;
    const pizza = pizzaIds(usable);

    const lines: CartLine[] = [];
    for (const l of input.lines) {
      const priced = repriceLine(l as CartLine, usable, input.restaurantId);
      if (!priced)
        return { ok: false, error: "Niektorý produkt už nie je dostupný." };
      lines.push(priced);
    }

    let zone: DeliveryZone | null = null;
    if (input.fulfillment === "delivery" && input.address) {
      const zoneRows = (await sql`
        SELECT id, restaurant_id, name, minimum_order, delivery_fee,
               estimated_minutes, areas
        FROM delivery_zones WHERE restaurant_id = ${input.restaurantId}
        ORDER BY sort`) as ZoneRow[];
      const usableZones = zoneRows.length
        ? zoneRows.map(rowToZone)
        : RESTAURANTS.find((r) => r.id === input.restaurantId)
            ?.deliveryZones ?? [];
      zone = matchZone(usableZones, `${input.address.street} ${input.address.city}`);
    }

    const totals = computeTotals(
      lines,
      input.restaurantId,
      zone,
      input.fulfillment,
      null,
      COUPONS
    );
    const phone = (input.phone ?? "").trim();
    const name = (input.customerName ?? "").trim() || phone || "Objednávka";
    const note = input.note?.trim() ? input.note.trim() : null;

    await sql`
      UPDATE orders SET
        fulfillment = ${input.fulfillment},
        customer_name = ${name}, phone = ${phone},
        address = ${input.address ? JSON.stringify(input.address) : null},
        zone_name = ${zone?.name ?? null},
        lines = ${JSON.stringify(lines)}, pizza_count = ${pizzaCount(lines, pizza)},
        subtotal = ${totals.subtotal}, delivery_fee = ${totals.deliveryFee},
        discount = ${totals.discount}, total = ${totals.total},
        payment = ${input.fulfillment === "delivery" ? "Platba pri doručení" : "Platba pri odbere"},
        note = ${note}
      WHERE id = ${id} AND restaurant_id = ${ctx.restaurantId}
        AND COALESCE(paid, false) = false
    `;
    await audit({
      action: "order.staff_updated",
      actorId: ctx.userId,
      actorEmail: ctx.email,
      restaurantId: input.restaurantId,
      target: id,
      meta: { total: totals.total, role: ctx.role },
    });
    return { ok: true, id, total: totals.total };
  } catch (e) {
    console.error("updateStaffOrder failed", e);
    return { ok: false, error: "Zmeny sa nepodarilo uložiť." };
  }
}
