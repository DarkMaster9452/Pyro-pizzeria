"use server";

import { randomUUID } from "crypto";
import { sql } from "./db";
import { auth } from "@/auth";
import {
  registerUser,
  getSessionVersion,
  getPasswordAgeDays,
  isPasswordExpired,
  getEmailOptIn,
  setEmailOptIn,
  hashPassword,
  ensureStaffAccounts,
  PASSWORD_MAX_AGE_DAYS,
  PASSWORD_REMIND_DAYS,
} from "./users";
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
import {
  estimatedWait,
  shortId,
  formatAddress,
  POL_POL_SURCHARGE,
  POL_POL_LABEL,
  NON_PIZZA_FLYER_NUMBERS,
} from "./utils";
import { orderInputSchema, firstError } from "./validation";
import { rateLimit, audit, clientIp } from "./security";
import { logError, logWarn } from "./log";
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
const eurText = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

// Ids of products that count as real pizzas. Products arrive in menu (sort)
// order grouped per restaurant, so we number the pizza-category items 1..N and
// drop the dough sides (flyer numbers 21–23) — they don't count toward the
// pizza queue and can't be pol/pol.
function pizzaIds(products: Product[]): Set<string> {
  const out = new Set<string>();
  const counters: Record<string, number> = {};
  for (const p of products) {
    if (p.category !== "pizza") continue;
    const n = (counters[p.restaurantId] = (counters[p.restaurantId] ?? 0) + 1);
    if (!NON_PIZZA_FLYER_NUMBERS.has(n)) out.add(p.id);
  }
  return out;
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

    // Coupons are NOT auto-seeded. They are fully admin-managed, so once an
    // admin deletes them they stay deleted — previously the sample coupons were
    // re-inserted on every load whenever the table was empty, so a deleted
    // coupon (e.g. PYRO10) kept reappearing.

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
    // Whether the order was paid by card. NULL = unknown → fall back to the
    // payment label. Card money is pooled (not tied to a driver's cash wallet).
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS by_card boolean`;
    // Order was modified after entering the kitchen — it re-runs prep with an
    // "upravená" tag so cooks know to check what changed.
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS edited boolean NOT NULL DEFAULT false`;
    // Reason the admin flipped a paid order back to unpaid.
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS unpaid_note text`;
    // Human summary of what the last edit changed (items added/removed, total).
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS edit_note text`;
    // Per-order secret returned to the customer at checkout so they can cancel
    // their own order (IDs are sequential and therefore guessable).
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_token text`;
    // Kitchen/admin-applied surcharge for custom requests (e.g. a half-and-half
    // pizza written in the note). Stored separately from `total` so it can be
    // toggled idempotently; `total` always already includes it.
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS surcharge numeric(10,2) NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS surcharge_note text`;
    await sql`CREATE INDEX IF NOT EXISTS orders_driver_idx ON orders (driver_id)`;
    await sql`CREATE INDEX IF NOT EXISTS orders_user_idx ON orders (user_id)`;
    // Human-friendly, sequential order numbers (e.g. #1001) instead of random
    // codes. Used as the order id/PK.
    await sql`CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1001`;
    // Daily open / availability / staff shifts.
    await sql`ALTER TABLE restaurant_state ADD COLUMN IF NOT EXISTS open_date date`;
    // Calendar date the "vypredané" flag was set — it clears itself at midnight.
    await sql`ALTER TABLE restaurant_state ADD COLUMN IF NOT EXISTS sold_out_date date`;
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
    // Saved end-of-day tip split, one row per service day. driver_cash holds the
    // cash each driver handed in: [{ id, name, amount }]; allocations holds who
    // took how much of the tips: [{ id, name, role, amount }]. tips_total is the
    // signed difference (collected − expected): positive = tips, negative = manko.
    await sql`
      CREATE TABLE IF NOT EXISTS shift_tips (
        restaurant_id text NOT NULL,
        service_date date NOT NULL,
        expected_total numeric(10,2) NOT NULL DEFAULT 0,
        driver_cash jsonb NOT NULL DEFAULT '[]'::jsonb,
        expected_cash numeric(10,2) NOT NULL DEFAULT 0,
        counted_cash numeric(10,2) NOT NULL DEFAULT 0,
        expected_card numeric(10,2) NOT NULL DEFAULT 0,
        counted_card numeric(10,2) NOT NULL DEFAULT 0,
        starting_float numeric(10,2) NOT NULL DEFAULT 0,
        tips_total numeric(10,2) NOT NULL DEFAULT 0,
        allocations jsonb NOT NULL DEFAULT '[]'::jsonb,
        saved_by text,
        saved_by_email text,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (restaurant_id, service_date)
      )`;
    // Columns added after the first release of shift_tips.
    await sql`ALTER TABLE shift_tips ADD COLUMN IF NOT EXISTS expected_total numeric(10,2) NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE shift_tips ADD COLUMN IF NOT EXISTS driver_cash jsonb NOT NULL DEFAULT '[]'::jsonb`;
    // Daily settlement extras: per-person wages, total wage, pizzas that day.
    await sql`ALTER TABLE shift_tips ADD COLUMN IF NOT EXISTS wages jsonb NOT NULL DEFAULT '[]'::jsonb`;
    await sql`ALTER TABLE shift_tips ADD COLUMN IF NOT EXISTS wage_total numeric(10,2) NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE shift_tips ADD COLUMN IF NOT EXISTS pizza_count int NOT NULL DEFAULT 0`;
    // Owner accounts take neither tips nor wages (they own the place).
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false`;
  })().catch((e) => {
    orderColumnsPromise = null;
    throw e;
  });
  return orderColumnsPromise;
}

// The service day is the plain Bratislava calendar date — it rolls over at
// midnight, not noon. (Service ends by 22:00 so nothing ever crosses midnight;
// a calendar-day boundary keeps the manual open flag, staff shifts, saved tips
// and the "today" stats all aligned to the date shown in the reports.)
const SERVICE_DATE = "(now() AT TIME ZONE 'Europe/Bratislava')::date";

// Whether an order counts as card-paid: the explicit by_card flag if set, else
// fall back to the payment label ("Karta …"). Card money is pooled to the card
// total instead of a driver's cash wallet.
const IS_CARD = "COALESCE(by_card, COALESCE(payment,'') ILIKE '%karta%')";

// The plain Bratislava calendar date. Daily state that must clear at midnight —
// the "vypredané" flag and today's unavailable items — is keyed to this, so it
// resets at 00:00 rather than at noon.
const RESET_DATE = "(now() AT TIME ZONE 'Europe/Bratislava')::date";

// Next sequential order number (as text, since the order id is a text PK).
// Falls back to a random code if the sequence is somehow unavailable.
async function nextOrderId(): Promise<string> {
  try {
    const rows = (await sql`SELECT nextval('order_number_seq') AS n`) as {
      n: number | string;
    }[];
    if (rows[0]?.n != null) return String(rows[0].n);
  } catch (e) {
    logWarn("nextOrderId", "sequence unavailable, using fallback id");
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
    // Mark items the admin flagged unavailable for today (per restaurant) as
    // unavailable — they stay on the menu but can't be ordered, same as the
    // admin per-product availability toggle. We don't drop them from the list.
    const unavRows = (await sql.query(
      `SELECT restaurant_id, product_id FROM daily_unavailable
       WHERE service_date = ${RESET_DATE}`,
      []
    )) as { restaurant_id: string; product_id: string }[];
    if (unavRows.length) {
      const unav = new Set(
        unavRows.map((u) => `${u.restaurant_id}-${u.product_id}`)
      );
      products = products.map((p) =>
        unav.has(p.id) ? { ...p, available: false } : p
      );
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
    // A restaurant counts as "open for orders" only while it is manually opened
    // AND still inside the ordering window (orders stop 30 min before close).
    for (const o of openRows)
      open[o.id] = !!o.is_open && !orderingCutoff(o.id);
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
    const rows = (await sql.query(
      `SELECT id, (sold_out AND sold_out_date = ${RESET_DATE}) AS sold_out
       FROM restaurant_state`,
      []
    )) as {
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
  cancelToken?: string;
}

// Re-price a cart line from the DATABASE menu — the client's unitPrice is
// discarded. Returns null for an unknown / unavailable product.
function repriceLine(
  line: CartLine,
  products: Product[],
  restaurantId: string,
  pizzaSet?: Set<string>
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
  // pol/pol only applies to real pizzas; ignore the flag on anything else.
  const polpol =
    !!line.polpol && (!pizzaSet || pizzaSet.has(product.id));
  if (polpol) unit += POL_POL_SURCHARGE;
  for (const name of line.addedIngredients) {
    const ing = EXTRA_INGREDIENTS.find((i) => i.name === name);
    if (ing) unit += ing.price;
  }
  return {
    ...line,
    polpol,
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
      `SELECT (sold_out AND sold_out_date = ${RESET_DATE}) AS sold_out,
              COALESCE(open_date = ${SERVICE_DATE}, false) AS is_open
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
    // Once the day's closing time passes, new orders stop. Orders already
    // placed are unaffected — the kitchen finishes what's in the queue.
    if (orderingCutoff(data.restaurantId))
      return {
        ok: false,
        error: "Otváracie hodiny na dnes skončili — objednávky sú uzavreté.",
      };

    // items the admin marked unavailable for today
    const unavRows = (await sql.query(
      `SELECT product_id FROM daily_unavailable
       WHERE restaurant_id = $1 AND service_date = ${RESET_DATE}`,
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
        data.restaurantId,
        pizza
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
    const cancelToken = randomUUID();
    await sql`
      INSERT INTO orders (
        id, restaurant_id, status, fulfillment, customer_name, phone, email,
        address, zone_name, lines, pizza_count, subtotal, delivery_fee,
        discount, total, payment, note, eta, user_id, cancel_token
      ) VALUES (
        ${id}, ${data.restaurantId}, 'received', ${data.fulfillment},
        ${data.customerName}, ${data.phone}, ${data.email || null},
        ${data.address ? JSON.stringify(data.address) : null},
        ${zone?.name ?? null}, ${JSON.stringify(lines)},
        ${pizzaCount(lines, pizza)},
        ${totals.subtotal}, ${totals.deliveryFee}, ${totals.discount},
        ${totals.total},
        ${paymentLabel},
        ${data.note || null}, ${eta}, ${userId}, ${cancelToken}
      )
    `;
    await audit({
      action: "order.created",
      restaurantId: data.restaurantId,
      target: id,
      meta: { total: totals.total, fulfillment: data.fulfillment, ip },
    });
    return { ok: true, id, total: totals.total, eta, cancelToken };
  } catch (e) {
    logError("createOrder", e);
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
    // Admins have no personal name — always a generic label.
    name: session.user.name || "Admin",
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

// ===========================================================================
// Account management (admin) — gated by a SEPARATE management password on top
// of an admin session. Lets an admin manage every account that exists: rename,
// change the login email, role + pizzeria, owner flag, deactivate/reactivate,
// reset the password (hashed with Argon2id, so it actually works at login,
// unlike a raw SQL update) and unlock an account locked by failed logins.
// The gate password is a bootstrap value the owner rotates in code.
// ===========================================================================
const ACCOUNT_MGMT_PASSWORD = "MARTIN";
const MANAGEABLE_ROLES = [
  "customer",
  "driver",
  "kuchar",
  "call",
  "admin",
] as const;
type ManageableRole = (typeof MANAGEABLE_ROLES)[number];
const KNOWN_RESTAURANT_IDS = RESTAURANTS.map((r) => r.id);

export interface ManagedAccount {
  id: string;
  email: string;
  name: string;
  role: string;
  restaurantId: string | null;
  isOwner: boolean;
  active: boolean;
  locked: boolean;
  failedAttempts: number;
  self: boolean; // the currently signed-in admin's own account
}

export interface AccountSaveInput {
  id: string;
  name: string;
  email: string;
  role: string;
  restaurantId: string | null;
  isOwner: boolean;
  active: boolean;
  newPassword?: string;
}

// Shared gate: an admin session + the correct management password. Returns the
// session on success, or an error string the caller surfaces to the UI.
async function gateAccountMgmt(gate: string) {
  const session = await auth();
  // Distinguish "not signed in / session expired" from "signed in but not an
  // admin" — otherwise an admin whose staff session quietly timed out (2h when
  // the shop is closed, 8h when open) sees a misleading "insufficient rights".
  if (!session?.user) {
    return {
      ok: false as const,
      error: "Relácia vypršala – prihláste sa znova ako admin.",
    };
  }
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    return {
      ok: false as const,
      error: "Nedostatočné oprávnenie – tento účet nie je admin.",
    };
  }
  const current = await getSessionVersion(session.user.id);
  if (current !== null && current !== session.user.sessionVersion) {
    return { ok: false as const, error: "Relácia vypršala, prihláste sa znova." };
  }
  if (gate !== ACCOUNT_MGMT_PASSWORD) {
    return { ok: false as const, error: "Nesprávne heslo pre správu účtov." };
  }
  return { ok: true as const, session };
}

export async function listAccounts(
  gate: string
): Promise<{ ok: boolean; error?: string; accounts?: ManagedAccount[] }> {
  const g = await gateAccountMgmt(gate);
  if (!g.ok) return { ok: false, error: g.error };
  await ensureStaffAccounts().catch(() => {});
  await ensureOrderColumns().catch(() => {});
  const rows = (await sql`
    SELECT id, email, name, role, restaurant_id,
           COALESCE(is_owner, false) AS is_owner,
           COALESCE(active, true) AS active,
           failed_attempts, locked_until
    FROM users
    ORDER BY (role = 'customer'), role, email
  `) as {
    id: string;
    email: string;
    name: string;
    role: string;
    restaurant_id: string | null;
    is_owner: boolean;
    active: boolean;
    failed_attempts: number;
    locked_until: string | null;
  }[];
  const now = Date.now();
  const accounts: ManagedAccount[] = rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role,
    restaurantId: r.restaurant_id,
    isOwner: r.is_owner,
    active: r.active,
    locked: !!r.locked_until && new Date(r.locked_until).getTime() > now,
    failedAttempts: r.failed_attempts ?? 0,
    self: r.id === g.session.user.id,
  }));
  return { ok: true, accounts };
}

export async function saveAccount(
  gate: string,
  input: AccountSaveInput
): Promise<{ ok: boolean; error?: string }> {
  const g = await gateAccountMgmt(gate);
  if (!g.ok) return { ok: false, error: g.error };
  const session = g.session;

  const id = input.id;
  const name = (input.name ?? "").trim();
  const email = (input.email ?? "").toLowerCase().trim();
  const role = input.role;
  const restaurantId = input.restaurantId;
  const isOwner = !!input.isOwner;
  const active = !!input.active;
  const newPassword = input.newPassword?.trim() || "";

  // Validation.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { ok: false, error: "Neplatný email." };
  if (!MANAGEABLE_ROLES.includes(role as ManageableRole))
    return { ok: false, error: "Neplatná rola." };
  if (restaurantId !== null && !KNOWN_RESTAURANT_IDS.includes(restaurantId))
    return { ok: false, error: "Neplatná prevádzka." };
  // Staff roles must belong to a pizzeria; customers have none.
  if (role !== "customer" && restaurantId === null)
    return { ok: false, error: "Zamestnanecký účet musí mať prevádzku." };
  if (newPassword && newPassword.length < 6)
    return { ok: false, error: "Heslo musí mať aspoň 6 znakov." };

  // Self-lockout guards: an admin cannot deactivate their own account or strip
  // their own admin role while signed in (avoids locking yourself out).
  if (id === session.user.id && !active)
    return { ok: false, error: "Nemôžete deaktivovať vlastný účet." };
  if (id === session.user.id && role !== "admin" && role !== "super_admin")
    return { ok: false, error: "Nemôžete si odobrať admin rolu." };

  // The account must exist.
  const existing = (await sql`SELECT id FROM users WHERE id = ${id} LIMIT 1`) as {
    id: string;
  }[];
  if (!existing.length) return { ok: false, error: "Účet sa nenašiel." };

  // Email must stay unique.
  const clash = (await sql`
    SELECT 1 FROM users WHERE email = ${email} AND id <> ${id} LIMIT 1
  `) as unknown[];
  if (clash.length) return { ok: false, error: "Email už používa iný účet." };

  await sql`
    UPDATE users
    SET name = ${name}, email = ${email}, role = ${role},
        restaurant_id = ${restaurantId}, is_owner = ${isOwner}, active = ${active}
    WHERE id = ${id}
  `;
  // Deactivating signs the account out of every device it is logged into.
  if (!active) {
    await sql`UPDATE users SET session_version = session_version + 1 WHERE id = ${id}`;
  }

  if (newPassword) {
    const pwHash = await hashPassword(newPassword);
    await sql`
      UPDATE users
      SET password_hash = ${pwHash}, password_changed_at = now(),
          failed_attempts = 0, locked_until = NULL,
          session_version = session_version + 1
      WHERE id = ${id}
    `;
  }

  await audit({
    action: "account.updated",
    actorId: session.user.id,
    actorEmail: session.user.email,
    target: email,
    meta: {
      role,
      restaurantId,
      active,
      owner: isOwner,
      passwordReset: !!newPassword,
    },
  });
  return { ok: true };
}

// Clear a lockout from repeated failed logins (resets the counter + unlock).
export async function unlockAccount(
  gate: string,
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const g = await gateAccountMgmt(gate);
  if (!g.ok) return { ok: false, error: g.error };
  await sql`
    UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ${id}
  `;
  await audit({
    action: "account.unlocked",
    actorId: g.session.user.id,
    actorEmail: g.session.user.email,
    target: id,
  });
  return { ok: true };
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
  byCard: boolean; // paid by card
  edited: boolean; // order was modified after entering the kitchen
  unpaid: boolean; // flipped back to unpaid (has a reason note)
  note: string | null;
  driverName: string | null;
  lines: { name: string; quantity: number; note?: string; polpol?: boolean }[];
}

interface AdminOrderRaw {
  id: string;
  status: string;
  fulfillment: string;
  customer_name: string;
  total: number;
  pizza_count: number;
  lines: { name: string; quantity: number; note?: string; polpol?: boolean }[];
  paid: boolean;
  by_card: boolean;
  edited: boolean;
  unpaid: boolean;
  note: string | null;
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
    byCard: o.by_card,
    edited: o.edited,
    unpaid: o.unpaid,
    note: o.note,
    driverName: o.driver_name,
    lines: Array.isArray(o.lines) ? o.lines : [],
  };
}

const ADMIN_ORDER_COLS = `id, status, fulfillment, customer_name, total::float AS total,
  pizza_count, lines, COALESCE(paid, false) AS paid,
  COALESCE(by_card, COALESCE(payment,'') ILIKE '%karta%') AS by_card,
  COALESCE(edited, false) AS edited,
  (COALESCE(paid, false) = false AND unpaid_note IS NOT NULL) AS unpaid,
  note, driver_name, created_at,
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
  cashToday: number;
  cardToday: number;
  weekThis: number; // revenue in the current Mon–Sun week (open days only earn)
  weekLast: number; // revenue in the previous week
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

  // "Today" = the Bratislava calendar day.
  const todaySql = `(created_at AT TIME ZONE 'Europe/Bratislava')::date = ${SERVICE_DATE}`;

  const pending = (await sql`
    SELECT COALESCE(SUM(pizza_count),0)::int AS pizzas, COUNT(*)::int AS cnt
    FROM orders
    WHERE restaurant_id = ${restaurantId}
      AND status IN ('received','accepted','preparing')
  `) as { pizzas: number; cnt: number }[];

  const today = (await sql.query(
    `SELECT COALESCE(SUM(pizza_count),0)::int AS pizzas,
            COUNT(*)::int AS cnt,
            COALESCE(SUM(total),0)::float AS revenue,
            COALESCE(SUM(total) FILTER (WHERE NOT ${IS_CARD}),0)::float AS cash,
            COALESCE(SUM(total) FILTER (WHERE ${IS_CARD}),0)::float AS card
     FROM orders
     WHERE restaurant_id = $1 AND status <> 'cancelled'
       AND ${todaySql}`,
    [restaurantId]
  )) as { pizzas: number; cnt: number; revenue: number; cash: number; card: number }[];

  // This Mon–Sun week vs the previous one (closed days simply contribute 0, so
  // this is effectively the 4 open days compared week-over-week).
  const weekCmp = (await sql.query(
    `SELECT
       COALESCE(SUM(total) FILTER (WHERE date_trunc('week', (created_at AT TIME ZONE 'Europe/Bratislava'))
         = date_trunc('week', (now() AT TIME ZONE 'Europe/Bratislava'))),0)::float AS this_week,
       COALESCE(SUM(total) FILTER (WHERE date_trunc('week', (created_at AT TIME ZONE 'Europe/Bratislava'))
         = date_trunc('week', (now() AT TIME ZONE 'Europe/Bratislava')) - interval '7 days'),0)::float AS last_week
     FROM orders
     WHERE restaurant_id = $1 AND status <> 'cancelled'
       AND created_at >= now() - interval '15 days'`,
    [restaurantId]
  )) as { this_week: number; last_week: number }[];

  // real 7-day revenue (for the dashboard bar chart). Bucket by the
  // Europe/Bratislava calendar day and return the key as text; the JS side
  // builds matching Bratislava-day keys. (The previous code keyed the lookup on
  // UTC `toISOString()` dates while grouping by Bratislava days, so the keys
  // never matched and every bar read 0.)
  const weekRows = (await sql`
    SELECT (date_trunc('day', (created_at AT TIME ZONE 'Europe/Bratislava')))::date::text AS d,
           COALESCE(SUM(total),0)::float AS revenue
    FROM orders
    WHERE restaurant_id = ${restaurantId} AND status <> 'cancelled'
      AND created_at >= now() - interval '7 days'
    GROUP BY 1
  `) as { d: string; revenue: number }[];
  const revByDate = new Map(weekRows.map((r) => [r.d, r.revenue]));
  // YYYY-MM-DD and short weekday, both in Europe/Bratislava.
  const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bratislava",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const week: { label: string; value: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dt = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = dayKeyFmt.format(dt); // Bratislava calendar day
    const braWeekday = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Bratislava",
      weekday: "short",
    }).format(dt);
    const dowMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    week.push({
      label: DAY_LABELS[dowMap[braWeekday] ?? 0],
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
           pizza_count, lines, COALESCE(paid, false) AS paid,
           COALESCE(by_card, COALESCE(payment,'') ILIKE '%karta%') AS by_card,
           COALESCE(edited, false) AS edited,
           (COALESCE(paid, false) = false AND unpaid_note IS NOT NULL) AS unpaid,
           note, driver_name,
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
    lines: { name: string; quantity: number; note?: string; polpol?: boolean }[];
    paid: boolean;
    by_card: boolean;
    edited: boolean;
    unpaid: boolean;
    note: string | null;
    driver_name: string | null;
    created_at: string;
    mins_ago: number;
  }>;

  const state = (await sql.query(
    `SELECT (sold_out AND sold_out_date = ${RESET_DATE}) AS sold_out
     FROM restaurant_state WHERE id = $1 LIMIT 1`,
    [restaurantId]
  )) as { sold_out: boolean }[];

  const pendingPizzas = pending[0]?.pizzas ?? 0;
  return {
    soldOut: state[0]?.sold_out ?? false,
    pendingCount: pending[0]?.cnt ?? 0,
    pendingPizzas,
    waitMinutes: estimatedWait(base, pendingPizzas),
    soldToday: today[0]?.pizzas ?? 0,
    ordersToday: today[0]?.cnt ?? 0,
    revenueToday: Math.round((today[0]?.revenue ?? 0) * 100) / 100,
    cashToday: Math.round((today[0]?.cash ?? 0) * 100) / 100,
    cardToday: Math.round((today[0]?.card ?? 0) * 100) / 100,
    weekThis: Math.round((weekCmp[0]?.this_week ?? 0) * 100) / 100,
    weekLast: Math.round((weekCmp[0]?.last_week ?? 0) * 100) / 100,
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
      byCard: o.by_card,
      edited: o.edited,
      unpaid: o.unpaid,
      note: o.note,
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
  surcharge: number;
  surchargeNote: string | null;
  eta: number;
  createdAt: string;
  driverName: string | null;
  paid: boolean;
  pizzaCount: number; // real pizzas (excludes dough sides) — gates pol/pol
  byCard: boolean; // paid by card (pooled, not a driver's cash wallet)
  edited: boolean; // modified after entering the kitchen
  editNote: string | null; // what the last edit changed
  unpaidNote: string | null; // reason it was flipped back to unpaid
  // Editable while not delivered & unpaid, or (pickup) within 20 min of the
  // first payment.
  editable: boolean;
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
           total::float AS total, payment, note,
           COALESCE(surcharge, 0)::float AS surcharge, surcharge_note,
           eta, created_at, driver_name,
           COALESCE(paid, false) AS paid, COALESCE(pizza_count, 0)::int AS pizza_count,
           COALESCE(by_card, COALESCE(payment,'') ILIKE '%karta%') AS by_card,
           COALESCE(edited, false) AS edited, edit_note, unpaid_note,
           ((status <> 'delivered' AND COALESCE(paid, false) = false)
             OR (fulfillment = 'pickup' AND paid_at IS NOT NULL
                 AND paid_at > now() - interval '20 minutes')) AS editable
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
    surcharge: number;
    surcharge_note: string | null;
    eta: number;
    created_at: string;
    driver_name: string | null;
    paid: boolean;
    pizza_count: number;
    by_card: boolean;
    edited: boolean;
    edit_note: string | null;
    unpaid_note: string | null;
    editable: boolean;
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
    surcharge: o.surcharge,
    surchargeNote: o.surcharge_note,
    eta: o.eta,
    createdAt: o.created_at,
    driverName: o.driver_name,
    paid: o.paid,
    pizzaCount: o.pizza_count,
    byCard: o.by_card,
    edited: o.edited,
    editNote: o.edit_note,
    unpaidNote: o.unpaid_note,
    editable: o.editable,
  };
}

// Toggle whether an order was paid by card (admin correction). Locked once the
// order is paid — same rule as pol/pol.
export async function setOrderCard(
  restaurantId: string,
  id: string,
  card: boolean
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdmin(restaurantId);
  await ensureOrderColumns();
  const rows = (await sql`
    UPDATE orders SET by_card = ${card}
    WHERE id = ${id} AND restaurant_id = ${restaurantId}
      AND COALESCE(paid, false) = false
    RETURNING id
  `) as { id: string }[];
  if (!rows.length)
    return { ok: false, error: "Po zaplatení sa už spôsob platby nedá meniť." };
  await audit({
    action: "order.card_set",
    actorId: session.user.id,
    actorEmail: session.user.email,
    restaurantId,
    target: id,
    meta: { card },
  });
  return { ok: true };
}

// Flip a paid order back to unpaid — needs a reason so the day's money makes
// sense later. The reason is stored on the order and shown in its detail.
export async function markOrderUnpaid(
  restaurantId: string,
  id: string,
  reason: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdmin(restaurantId);
  await ensureOrderColumns();
  const note = reason.trim().slice(0, 300);
  if (!note) return { ok: false, error: "Napíšte dôvod, prečo je nezaplatená." };
  const rows = (await sql`
    UPDATE orders
    SET paid = false, paid_at = NULL, unpaid_note = ${note}
    WHERE id = ${id} AND restaurant_id = ${restaurantId}
      AND COALESCE(paid, false) = true
    RETURNING id
  `) as { id: string }[];
  if (!rows.length)
    return { ok: false, error: "Objednávka nie je zaplatená." };
  await audit({
    action: "order.marked_unpaid",
    actorId: session.user.id,
    actorEmail: session.user.email,
    restaurantId,
    target: id,
    meta: { reason: note },
  });
  return { ok: true };
}

export async function setSoldOut(restaurantId: string, value: boolean) {
  const session = await requireAdmin(restaurantId);
  await ensureOrderColumns();
  if (value) {
    // Marking sold out closes the pizzeria for the rest of the day (clears the
    // manual open flag). The "vypredané" flag stays visible until it resets on
    // its own at midnight (sold_out_date no longer matches today).
    await sql.query(
      `UPDATE restaurant_state
       SET sold_out = true, sold_out_date = ${RESET_DATE},
           open_date = NULL, updated_at = now()
       WHERE id = $1`,
      [restaurantId]
    );
  } else {
    // Resuming clears the flag and reopens the pizzeria for today's service day
    // (today's unavailable items and staff shifts set at open are still in
    // effect), so "Znovu spustiť objednávky" takes orders again right away.
    await sql.query(
      `UPDATE restaurant_state
       SET sold_out = false, sold_out_date = NULL,
           open_date = ${SERVICE_DATE}, updated_at = now()
       WHERE id = $1`,
      [restaurantId]
    );
  }
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

// Today's Bratislava closing time (minutes since midnight), or null when the
// day has no schedule entry at all. Every weekday has defined open/close times
// in the seed data — even nominally-closed days — so a manual (test) open still
// has a closing time to count down to and to auto-lock at.
function closeMinutesToday(restaurantId: string): number | null {
  const { weekdayIdx } = bratislavaNow();
  const r = RESTAURANTS.find((x) => x.id === restaurantId);
  const today = r?.openingHours.find((h) => h.day === weekdayIdx);
  if (!today) return null;
  return toMinutes(today.close);
}

// Whether new orders are locked right now (Europe/Bratislava). Once the day's
// closing time passes, ordering stops — this holds for regular opening days and
// for manual (test) opens alike, since both have a defined closing time. Orders
// already placed are never affected; only the ability to place NEW ones locks.
function orderingCutoff(restaurantId: string): boolean {
  const closeMin = closeMinutesToday(restaurantId);
  if (closeMin == null) return false; // no schedule entry → no auto-lock
  return bratislavaNow().minutes >= closeMin;
}

// Whether the day's service is over — the settlement (vyúčtovanie) may only be
// saved once the pizzeria is closed: manually closed / sold out (open flag
// cleared) or past today's closing time.
async function isClosedForToday(restaurantId: string): Promise<boolean> {
  const rows = (await sql.query(
    `SELECT COALESCE(open_date = ${SERVICE_DATE}, false) AS is_open
     FROM restaurant_state WHERE id = $1 LIMIT 1`,
    [restaurantId]
  )) as { is_open: boolean }[];
  if (!rows[0]?.is_open) return true; // never opened, closed manually or sold out
  const closeMin = closeMinutesToday(restaurantId);
  if (closeMin == null) return false; // no schedule entry — close manually
  return bratislavaNow().minutes >= closeMin;
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
  closeTime: string | null; // today's closing time "HH:MM" on regular opening days
  nowMinutes: number; // Bratislava minutes-since-midnight at fetch time
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
  let closeTime: string | null = null;
  // Closing time drives the countdown. Every weekday has defined open/close
  // times in the schedule (even nominally-closed days), so expose it whenever
  // a schedule entry exists — this way a test-open on a closed day still gets
  // a countdown.
  if (today) closeTime = today.close;
  if (!closedToday && today) {
    openTime = today.open;
    canOpenNow =
      !open &&
      minutes >= toMinutes(today.open) - 60 &&
      minutes < toMinutes(today.close);
  }
  return {
    serviceDate,
    open,
    canOpenNow,
    openTime,
    closeTime,
    nowMinutes: minutes,
    closedToday,
  };
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
     WHERE restaurant_id = $1 AND service_date = ${RESET_DATE}`,
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
  // Monthly password rotation: an admin whose password is 30+ days old cannot
  // start the service day until they change it (Prevádzka → zmena hesla).
  if (await isPasswordExpired(session.user.id)) {
    return {
      ok: false,
      error:
        "Uplynulo 30 dní od zmeny hesla. Pred otvorením prevádzky si zmeňte heslo v sekcii Prevádzka.",
    };
  }
  await ensureOrderColumns();
  // Housekeeping: the "unavailable today" list is per service day and is only
  // ever read for today's date, so old rows are dead weight. Keep the last
  // 3 days for reference and drop anything older (both pizzerias at once).
  await sql.query(
    `DELETE FROM daily_unavailable WHERE service_date < ${RESET_DATE} - 3`
  );
  // Mark open for today's service day.
  await sql.query(
    `UPDATE restaurant_state SET open_date = ${SERVICE_DATE}, updated_at = now()
     WHERE id = $1`,
    [restaurantId]
  );
  // Replace today's unavailable set.
  await sql.query(
    `DELETE FROM daily_unavailable
     WHERE restaurant_id = $1 AND service_date = ${RESET_DATE}`,
    [restaurantId]
  );
  for (const pid of unavailableIds.slice(0, 500)) {
    await sql.query(
      `INSERT INTO daily_unavailable (restaurant_id, product_id, service_date)
       VALUES ($1, $2, ${RESET_DATE}) ON CONFLICT DO NOTHING`,
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
  // Days that had a shift OR a saved tip record (so a saved split is never
  // hidden just because nobody was marked on shift that day). Staff list is
  // empty for tip-only days.
  const shiftRows = (await sql.query(
    `WITH days AS (
       SELECT service_date AS d FROM shifts WHERE restaurant_id = $1
       UNION
       SELECT service_date AS d FROM shift_tips WHERE restaurant_id = $1
     )
     SELECT days.d::text AS d,
            COALESCE(array_agg(s.name ORDER BY s.name) FILTER (WHERE s.name IS NOT NULL), '{}') AS staff
     FROM days
     LEFT JOIN shifts s ON s.restaurant_id = $1 AND s.service_date = days.d
     GROUP BY days.d ORDER BY days.d DESC LIMIT 31`,
    [restaurantId]
  )) as {
    d: string;
    staff: string[];
  }[];
  const orderRows = (await sql.query(
    `SELECT ((created_at AT TIME ZONE 'Europe/Bratislava')::date)::text AS d,
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

// ---------------------------------------------------------------------------
// End-of-day tip (tringelt) split. The admin counts the cash drawer, we work
// out how much is tips (counted − expected cash), and split it between the
// staff who were on shift today (cooks + drivers). The actual money entry and
// the equal split happen in the UI; here we just gather the basis.
// ---------------------------------------------------------------------------
export interface TipAllocation {
  id: string;
  name: string;
  role: string;
  amount: number;
}

export interface TipDriverCash {
  id: string; // driver user id, or "_counter" for pickup / unassigned cash
  name: string;
  expected: number; // cash they should have from their orders (read-only)
  amount: number; // cash they actually handed in (entered)
}

export interface TipWage {
  id: string;
  name: string;
  role: string;
  hours: number; // whole hours + 0 or 0.5
  wage: number; // hours * WAGE_PER_HOUR
}

export interface SavedTips {
  expectedTotal: number; // all orders that day (read-only basis)
  expectedCash: number; // cash orders total
  expectedCard: number; // card orders total
  driverCash: TipDriverCash[]; // per driver (+ counter): expected & actual
  countedCash: number; // = sum of driverCash amounts
  card: number; // single card (terminal) total actually taken
  diff: number; // collected − expected: positive = tips, negative = manko
  allocations: TipAllocation[];
  wages: TipWage[]; // per part-timer hours + wage
  wageTotal: number;
  pizzaCount: number; // real pizzas made that day
  savedByEmail: string | null;
  updatedAt: string;
}

export interface TipData {
  serviceDate: string;
  // Per-driver expected cash from their orders (+ a "Pult / odber" row for
  // pickup / unassigned cash). `amount` is prefilled from a saved split.
  drivers: TipDriverCash[];
  expectedCash: number; // all cash orders
  expectedCard: number; // all card orders (prefills the single card field)
  expectedTotal: number; // all orders (cash + card)
  orderCount: number;
  pizzaCount: number; // real pizzas made today (from orders)
  // Settlement can only be saved once the pizzeria is closed for the day.
  canSettle: boolean;
  // Everyone on shift today (cooks + drivers). Owners take no tips / wage.
  staff: { id: string; name: string; role: string; isOwner: boolean }[];
  saved: SavedTips | null;
}

interface TipRow {
  expected_total: string | number;
  expected_cash: string | number;
  expected_card: string | number;
  driver_cash: TipDriverCash[];
  counted_cash: string | number;
  counted_card: string | number;
  tips_total: string | number;
  allocations: TipAllocation[];
  wages: TipWage[];
  wage_total: string | number;
  pizza_count: string | number;
  saved_by_email: string | null;
  updated_at: string;
}

function rowToSavedTips(r: TipRow): SavedTips {
  return {
    expectedTotal: Number(r.expected_total),
    expectedCash: Number(r.expected_cash),
    expectedCard: Number(r.expected_card),
    driverCash: Array.isArray(r.driver_cash) ? r.driver_cash : [],
    countedCash: Number(r.counted_cash),
    card: Number(r.counted_card),
    diff: Number(r.tips_total),
    allocations: Array.isArray(r.allocations) ? r.allocations : [],
    wages: Array.isArray(r.wages) ? r.wages : [],
    wageTotal: Number(r.wage_total),
    pizzaCount: Number(r.pizza_count),
    savedByEmail: r.saved_by_email,
    updatedAt: r.updated_at,
  };
}

const TIP_ROW_COLS =
  "expected_total, expected_cash, expected_card, driver_cash, counted_cash, counted_card, tips_total, allocations, wages, wage_total, pizza_count, saved_by_email, updated_at";

export async function getTipData(restaurantId: string): Promise<TipData> {
  await requireAdmin(restaurantId);
  await ensureOrderColumns();

  const todayFilter = `restaurant_id = $1 AND status <> 'cancelled'
       AND (created_at AT TIME ZONE 'Europe/Bratislava')::date = ${SERVICE_DATE}`;

  // Cash vs card totals (payment is stored as a human label like "Hotovosť pri
  // doručení" / "Karta pri odbere"). "Today" = calendar day.
  const money = (await sql.query(
    `SELECT
       COALESCE(SUM(total) FILTER (WHERE NOT ${IS_CARD}),0)::float AS cash_sum,
       COUNT(*) FILTER (WHERE NOT ${IS_CARD})::int AS cash_cnt,
       COALESCE(SUM(total) FILTER (WHERE ${IS_CARD}),0)::float AS card_sum,
       COUNT(*) FILTER (WHERE ${IS_CARD})::int AS card_cnt
     FROM orders WHERE ${todayFilter}`,
    [restaurantId]
  )) as { cash_sum: number; cash_cnt: number; card_sum: number; card_cnt: number }[];

  // Cash grouped by the driver who collected it (driver_id NULL = counter/pickup).
  const perDriver = (await sql.query(
    `SELECT driver_id, COALESCE(SUM(total),0)::float AS cash
     FROM orders WHERE ${todayFilter} AND NOT ${IS_CARD}
     GROUP BY driver_id`,
    [restaurantId]
  )) as { driver_id: string | null; cash: number }[];
  const cashByDriver = new Map<string | null, number>(
    perDriver.map((r) => [r.driver_id, r.cash])
  );

  const staff = (await sql.query(
    `SELECT sh.user_id AS id, sh.name, sh.role,
            COALESCE(u.is_owner, false) AS is_owner
     FROM shifts sh
     LEFT JOIN users u ON u.id::text = sh.user_id
     WHERE sh.restaurant_id = $1 AND sh.service_date = ${SERVICE_DATE}
     ORDER BY sh.role, sh.name`,
    [restaurantId]
  )) as { id: string; name: string; role: string; is_owner: boolean }[];

  const pizzas = (await sql.query(
    `SELECT COALESCE(SUM(pizza_count),0)::int AS n
     FROM orders WHERE ${todayFilter}`,
    [restaurantId]
  )) as { n: number }[];

  const svc = (await sql.query(`SELECT (${SERVICE_DATE})::text AS d`, [])) as {
    d: string;
  }[];
  const savedRows = (await sql.query(
    `SELECT ${TIP_ROW_COLS} FROM shift_tips
     WHERE restaurant_id = $1 AND service_date = ${SERVICE_DATE} LIMIT 1`,
    [restaurantId]
  )) as TipRow[];
  const saved = savedRows[0] ? rowToSavedTips(savedRows[0]) : null;
  const savedAmount = new Map(
    (saved?.driverCash ?? []).map((d) => [d.id, d.amount])
  );

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const cashSum = money[0]?.cash_sum ?? 0;
  const cardSum = money[0]?.card_sum ?? 0;

  const shiftDrivers = staff.filter((s) => s.role === "driver");
  const drivers: TipDriverCash[] = shiftDrivers.map((d) => ({
    id: d.id,
    name: d.name,
    expected: r2(cashByDriver.get(d.id) ?? 0),
    amount: savedAmount.get(d.id) ?? 0,
  }));

  // Money is two buckets: driver wallets (cash) + card. Expected card is
  // everything that isn't a driver's expected cash (card orders + any pickup /
  // unassigned cash), i.e. total − sum(driver expected).
  const attributed = r2(drivers.reduce((s, d) => s + d.expected, 0));
  const expectedTotal = r2(cashSum + cardSum);

  return {
    serviceDate: svc[0]?.d ?? "",
    drivers,
    expectedCash: r2(cashSum),
    expectedCard: r2(expectedTotal - attributed),
    expectedTotal,
    orderCount: (money[0]?.cash_cnt ?? 0) + (money[0]?.card_cnt ?? 0),
    pizzaCount: pizzas[0]?.n ?? 0,
    canSettle: await isClosedForToday(restaurantId),
    staff: staff.map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      isOwner: s.is_owner,
    })),
    saved,
  };
}

// Mark a staff account as an owner (no tips / no wage) or a part-timer.
export async function setUserOwner(
  restaurantId: string,
  userId: string,
  isOwner: boolean
): Promise<{ ok: boolean }> {
  const session = await requireAdmin(restaurantId);
  await ensureOrderColumns();
  await sql`
    UPDATE users SET is_owner = ${isOwner}
    WHERE id::text = ${userId} AND restaurant_id = ${restaurantId}
  `;
  await audit({
    action: "user.owner_set",
    actorId: session.user.id,
    actorEmail: session.user.email,
    restaurantId,
    target: userId,
    meta: { isOwner },
  });
  return { ok: true };
}

// Save (upsert) today's settlement for the current service day.
export interface SaveTipsInput {
  expectedTotal: number;
  expectedCash: number;
  expectedCard: number;
  driverCash: TipDriverCash[]; // per driver: expected + actual
  card: number;
  diff: number; // collected − expected (signed)
  allocations: TipAllocation[];
  wages: TipWage[];
  wageTotal: number;
  pizzaCount: number;
}

export async function saveTips(
  restaurantId: string,
  input: SaveTipsInput
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdmin(restaurantId);
  await ensureOrderColumns();
  // Settlement only after the day is closed (manual close, sold out, or past
  // closing time) — otherwise the numbers would still be moving.
  if (!(await isClosedForToday(restaurantId)))
    return {
      ok: false,
      error: "Vyúčtovanie sa dá uložiť až po zatvorení prevádzky.",
    };
  const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
  const driverCash = (input.driverCash ?? []).slice(0, 50).map((d) => ({
    id: String(d.id),
    name: String(d.name),
    expected: r2(d.expected),
    amount: r2(d.amount),
  }));
  const countedCash = r2(driverCash.reduce((s, d) => s + d.amount, 0));
  const alloc = (input.allocations ?? []).slice(0, 50).map((a) => ({
    id: String(a.id),
    name: String(a.name),
    role: String(a.role),
    amount: r2(a.amount),
  }));
  const wages = (input.wages ?? []).slice(0, 50).map((w) => ({
    id: String(w.id),
    name: String(w.name),
    role: String(w.role),
    hours: Math.max(0, Math.round((Number(w.hours) || 0) * 2) / 2),
    wage: r2(w.wage),
  }));
  const wageTotal = r2(wages.reduce((s, w) => s + w.wage, 0));
  try {
    await sql.query(
      `INSERT INTO shift_tips (restaurant_id, service_date, expected_total,
         expected_cash, expected_card, driver_cash, counted_cash, counted_card,
         tips_total, allocations, wages, wage_total, pizza_count,
         saved_by, saved_by_email, updated_at)
       VALUES ($1, ${SERVICE_DATE}, $2, $3, $4, $5::jsonb, $6, $7, $8, $9::jsonb,
         $10::jsonb, $11, $12, $13, $14, now())
       ON CONFLICT (restaurant_id, service_date) DO UPDATE SET
         expected_total = EXCLUDED.expected_total,
         expected_cash = EXCLUDED.expected_cash,
         expected_card = EXCLUDED.expected_card,
         driver_cash = EXCLUDED.driver_cash,
         counted_cash = EXCLUDED.counted_cash,
         counted_card = EXCLUDED.counted_card,
         tips_total = EXCLUDED.tips_total,
         allocations = EXCLUDED.allocations,
         wages = EXCLUDED.wages,
         wage_total = EXCLUDED.wage_total,
         pizza_count = EXCLUDED.pizza_count,
         saved_by = EXCLUDED.saved_by,
         saved_by_email = EXCLUDED.saved_by_email,
         updated_at = now()`,
      [
        restaurantId,
        r2(input.expectedTotal),
        r2(input.expectedCash),
        r2(input.expectedCard),
        JSON.stringify(driverCash),
        countedCash,
        r2(input.card),
        r2(input.diff),
        JSON.stringify(alloc),
        JSON.stringify(wages),
        wageTotal,
        Math.max(0, Math.round(Number(input.pizzaCount) || 0)),
        session.user.id,
        session.user.email,
      ]
    );
    await audit({
      action: "settlement.saved",
      actorId: session.user.id,
      actorEmail: session.user.email,
      restaurantId,
      meta: { diff: r2(input.diff), people: alloc.length, wages: wageTotal },
    });
    return { ok: true };
  } catch (e) {
    logError("saveTips", e);
    return { ok: false, error: "Vyúčtovanie sa nepodarilo uložiť." };
  }
}

// Full detail for one past service day — staff, money split and saved tips.
export interface ShiftDayDetail {
  serviceDate: string;
  staff: { name: string; role: string }[];
  orders: number;
  revenue: number;
  cash: number;
  card: number;
  pizzas: number; // real pizzas made that day
  tips: SavedTips | null;
}

export async function getShiftDayDetail(
  restaurantId: string,
  serviceDate: string
): Promise<ShiftDayDetail> {
  await requireAdmin(restaurantId);
  await ensureOrderColumns();

  const staff = (await sql.query(
    `SELECT name, role FROM shifts
     WHERE restaurant_id = $1 AND service_date = $2::date
     ORDER BY role, name`,
    [restaurantId, serviceDate]
  )) as { name: string; role: string }[];

  // Orders booked on that service day (calendar day).
  const money = (await sql.query(
    `SELECT COUNT(*)::int AS cnt,
            COALESCE(SUM(total),0)::float AS revenue,
            COALESCE(SUM(pizza_count),0)::int AS pizzas,
            COALESCE(SUM(total) FILTER (WHERE NOT ${IS_CARD}),0)::float AS cash,
            COALESCE(SUM(total) FILTER (WHERE ${IS_CARD}),0)::float AS card
     FROM orders
     WHERE restaurant_id = $1 AND status <> 'cancelled'
       AND ((created_at AT TIME ZONE 'Europe/Bratislava')::date) = $2::date`,
    [restaurantId, serviceDate]
  )) as { cnt: number; revenue: number; pizzas: number; cash: number; card: number }[];

  const tipRows = (await sql.query(
    `SELECT ${TIP_ROW_COLS} FROM shift_tips
     WHERE restaurant_id = $1 AND service_date = $2::date LIMIT 1`,
    [restaurantId, serviceDate]
  )) as TipRow[];

  const r2 = (n: number) => Math.round((n ?? 0) * 100) / 100;
  return {
    serviceDate,
    staff,
    orders: money[0]?.cnt ?? 0,
    revenue: r2(money[0]?.revenue ?? 0),
    cash: r2(money[0]?.cash ?? 0),
    card: r2(money[0]?.card ?? 0),
    pizzas: money[0]?.pizzas ?? 0,
    tips: tipRows[0] ? rowToSavedTips(tipRows[0]) : null,
  };
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
  await ensureOrderColumns();
  // Single shared menu (restaurant_id 'all') — the same for both pizzerias.
  const rows = (await sql`
    SELECT id, restaurant_id, category, name, description, image, base_price,
           sizes, ingredients, allergens, badges, available
    FROM products WHERE restaurant_id = 'all' AND category <> 'drinks'
    ORDER BY sort, name
  `) as ProductRow[];
  // Items this restaurant marked unavailable for today (at opening or via this
  // toggle — it's the same list). They read as "off" here too.
  const unav = (await sql.query(
    `SELECT product_id FROM daily_unavailable
     WHERE restaurant_id = $1 AND service_date = ${RESET_DATE}`,
    [restaurantId]
  )) as { product_id: string }[];
  const unavSet = new Set(unav.map((u) => u.product_id));
  return rows.map((r) => {
    const p = rowToProduct(r);
    return { ...p, available: p.available && !unavSet.has(r.id) };
  });
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
    logError("saveProduct", e);
    return { ok: false, error: "Produkt sa nepodarilo uložiť." };
  }
}

export async function setProductAvailable(
  restaurantId: string,
  id: string,
  available: boolean
): Promise<{ ok: boolean }> {
  await requireAdmin(restaurantId);
  await ensureOrderColumns();
  // This is the same "unavailable today" list the opening flow uses — per
  // restaurant, resets at midnight. Turning a product off adds it; turning it
  // on removes it (and clears any legacy permanent "unavailable" flag).
  if (available) {
    await sql.query(
      `DELETE FROM daily_unavailable
       WHERE restaurant_id = $1 AND product_id = $2 AND service_date = ${RESET_DATE}`,
      [restaurantId, id]
    );
    await sql`
      UPDATE products SET available = true, updated_at = now()
      WHERE id = ${id} AND restaurant_id = 'all'
    `;
  } else {
    await sql.query(
      `INSERT INTO daily_unavailable (restaurant_id, product_id, service_date)
       VALUES ($1, $2, ${RESET_DATE}) ON CONFLICT DO NOTHING`,
      [restaurantId, id]
    );
  }
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
  id: string,
  token?: string | null
): Promise<PublicOrderStatus | null> {
  if (!id) return null;
  try {
    await ensureOrderColumns();
    // Anti-enumeration: order ids are short and sequential, so treating the id
    // alone as a bearer secret would let anyone scrape every order's status,
    // total and paid state. Require the per-order cancel token (handed to the
    // device at checkout) or ownership by the signed-in customer. A lenient IP
    // rate limit further blunts scraping while allowing the 5s tracking poll.
    const ip = await clientIp();
    const rl = await rateLimit("order_status", ip, 240, 60);
    if (!rl.allowed) return null;
    const rows = (await sql`
      SELECT id, restaurant_id, status, fulfillment,
             COALESCE(paid, false) AS paid, total::float AS total, eta,
             EXTRACT(EPOCH FROM (now() - paid_at)) AS paid_ago,
             cancel_token, user_id
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
      cancel_token: string | null;
      user_id: string | null;
    }>;
    const o = rows[0];
    if (!o) return null;
    const session = await auth();
    const owns =
      !!session?.user?.id && !!o.user_id && session.user.id === o.user_id;
    const tokenOk = !!token && !!o.cancel_token && token === o.cancel_token;
    // Staff (admin/kitchen/dispatch/call) may see any order in their own
    // restaurant — they already have far richer views of it elsewhere.
    const staffRole = session?.user?.role;
    const isStaff =
      !!staffRole &&
      staffRole !== "customer" &&
      session?.user?.restaurantId === o.restaurant_id;
    if (!owns && !tokenOk && !isStaff) return null;
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

// Statuses at which a customer may still cancel their own order — i.e. before
// the kitchen starts preparing it. Once it is "preparing" or later, cancelling
// is no longer allowed (food is already being made).
const CUSTOMER_CANCELABLE = ["received", "accepted"] as const;

// Customer-initiated cancellation. Authorised either by the per-order cancel
// token (handed to the device at checkout) or by ownership when signed in.
// Only succeeds while the order has not started being prepared.
export async function cancelOrder(
  id: string,
  token?: string | null
): Promise<{ ok: boolean; error?: string; status?: string }> {
  if (!id) return { ok: false, error: "Neznáma objednávka." };
  try {
    await ensureOrderColumns();
    // Defence-in-depth: rate-limit cancellation attempts so the per-order
    // cancel token (a UUID) can't be brute-forced by hammering this action.
    const ip = await clientIp();
    const rl = await rateLimit("order_cancel", ip, 30, 10 * 60);
    if (!rl.allowed)
      return { ok: false, error: "Príliš veľa pokusov. Skúste o chvíľu." };
    const rows = (await sql`
      SELECT restaurant_id, status, COALESCE(paid, false) AS paid,
             cancel_token, user_id
      FROM orders WHERE id = ${id} LIMIT 1
    `) as Array<{
      restaurant_id: string;
      status: string;
      paid: boolean;
      cancel_token: string | null;
      user_id: string | null;
    }>;
    const o = rows[0];
    if (!o) return { ok: false, error: "Objednávka neexistuje." };

    // Authorise: matching token, or the signed-in owner of the order.
    const session = await auth();
    const owns =
      !!session?.user?.id && !!o.user_id && session.user.id === o.user_id;
    const tokenOk = !!token && !!o.cancel_token && token === o.cancel_token;
    if (!owns && !tokenOk) {
      return { ok: false, error: "Túto objednávku nie je možné zrušiť." };
    }

    if (o.status === "cancelled") return { ok: true, status: "cancelled" };
    if (o.paid || !CUSTOMER_CANCELABLE.includes(o.status as never)) {
      return {
        ok: false,
        error: "Objednávku už nie je možné zrušiť — pripravuje sa.",
        status: o.status,
      };
    }

    // Guard against a race with the kitchen: only flip to cancelled if the
    // status is still cancelable at write time.
    const updated = (await sql`
      UPDATE orders SET status = 'cancelled'
      WHERE id = ${id} AND status IN ('received', 'accepted')
        AND COALESCE(paid, false) = false
      RETURNING id
    `) as unknown[];
    if (!updated.length) {
      return {
        ok: false,
        error: "Objednávku už nie je možné zrušiť — pripravuje sa.",
      };
    }
    await audit({
      action: "order.cancelled_by_customer",
      restaurantId: o.restaurant_id,
      target: id,
    });
    return { ok: true, status: "cancelled" };
  } catch (e) {
    logError("cancelOrder", e);
    return { ok: false, error: "Zrušenie sa nepodarilo. Skúste znova." };
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
  // Staff accounts have no customer profile — never pre-fill checkout from them.
  if (session.user.role !== "customer") return { ...empty, loggedIn: true };
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
  // Only real customers own a saved profile. Staff accounts (admin, driver,
  // kuchar) must never have a name/phone/address written to them — otherwise a
  // staff member going through checkout would overwrite e.g. the admin account
  // with a personal identity and delivery/payment details.
  if (session.user.role !== "customer") return { ok: false };
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

// ---- Notification preferences (customers) — email is the only channel ----
export interface NotificationPrefs {
  loggedIn: boolean;
  email: boolean; // opted in to email notifications (default: yes)
}

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const session = await auth();
  if (!session?.user?.id) return { loggedIn: false, email: true };
  try {
    return { loggedIn: true, email: await getEmailOptIn(session.user.id) };
  } catch {
    return { loggedIn: true, email: true };
  }
}

export async function setEmailNotifications(
  value: boolean
): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  try {
    await setEmailOptIn(session.user.id, value);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

// ---- Staff password rotation notice (monthly, primarily admin) ----
export interface StaffPasswordNotice {
  ageDays: number;
  maxAgeDays: number;
  mustChange: boolean; // 30d reached — hard-blocks opening the day
  remindSoon: boolean; // within the 4-day window, and only on operating days
}

// Only meaningful for staff. Customers get null. The reminder shows only in the
// 4 days before the 30-day mark AND only on operating days (Thu–Sun), matching
// when staff actually log in to work.
export async function getStaffPasswordNotice(): Promise<StaffPasswordNotice | null> {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user?.id || !role || role === "customer") return null;
  const ageDays = await getPasswordAgeDays(session.user.id).catch(() => null);
  if (ageDays == null) return null;
  const mustChange = ageDays >= PASSWORD_MAX_AGE_DAYS;
  const { weekdayIdx } = bratislavaNow(); // 0=Mon … 6=Sun
  const isOperatingDay = weekdayIdx >= 3; // Thu(3) … Sun(6)
  const remindSoon =
    !mustChange &&
    ageDays >= PASSWORD_MAX_AGE_DAYS - PASSWORD_REMIND_DAYS &&
    isOperatingDay;
  return {
    ageDays,
    maxAgeDays: PASSWORD_MAX_AGE_DAYS,
    mustChange,
    remindSoon,
  };
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
// Admins are view-only on the delivery board — they can watch what stage an
// order is at, but never claim/release/deliver/settle it. Only couriers manage
// the actual dispatch.
const ADMIN_DISPATCH_BLOCKED =
  "Rozvoz spravujú len kuriéri — admin má iba náhľad.";
function isAdminRole(role: string): boolean {
  return role === "admin" || role === "super_admin";
}

export async function claimDispatchOrder(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireDispatcher();
  if (isAdminRole(ctx.role))
    return { ok: false, error: ADMIN_DISPATCH_BLOCKED };
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

// Release an order the current courier holds. Admins can't touch dispatch.
export async function releaseDispatchOrder(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireDispatcher();
  if (isAdminRole(ctx.role))
    return { ok: false, error: ADMIN_DISPATCH_BLOCKED };
  await ensureOrderColumns();
  const rows = (await sql`
    UPDATE orders SET driver_id = NULL, driver_name = NULL
    WHERE id = ${id} AND restaurant_id = ${ctx.restaurantId}
      AND driver_id = ${ctx.userId} AND COALESCE(paid, false) = false
    RETURNING id`) as { id: string }[];
  if (!rows.length) return { ok: false, error: "Nedá sa uvoľniť." };
  return { ok: true };
}

// Mark an order as on the way. Auto-claims for the current dispatcher if the
// order is still unassigned.
export async function markDispatchDelivering(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireDispatcher();
  if (isAdminRole(ctx.role))
    return { ok: false, error: ADMIN_DISPATCH_BLOCKED };
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

// Drivers on shift today (max ~2 — the number of cash wallets). Falls back to
// every driver of the restaurant if nobody was assigned a shift, so the admin
// always has a wallet to attribute a counter payment to.
export interface ShiftDriver {
  id: string;
  name: string;
}
async function getShiftDriversInternal(
  restaurantId: string
): Promise<ShiftDriver[]> {
  const shift = (await sql.query(
    `SELECT user_id::text AS id, name FROM shifts
     WHERE restaurant_id = $1 AND service_date = ${SERVICE_DATE}
       AND role = 'driver'
     ORDER BY name`,
    [restaurantId]
  )) as ShiftDriver[];
  if (shift.length) return shift;
  const all = (await sql`
    SELECT id::text AS id, name FROM users
    WHERE restaurant_id = ${restaurantId} AND role = 'driver'
    ORDER BY name
  `) as ShiftDriver[];
  return all;
}

export async function getShiftDrivers(
  restaurantId: string
): Promise<ShiftDriver[]> {
  await requireAdmin(restaurantId);
  await ensureOrderColumns();
  return getShiftDriversInternal(restaurantId);
}

// Mark the order paid — the terminal step. Finalises it as delivered + paid.
// A driver may only settle a delivery order assigned to them. Admins never
// touch delivery, but may settle a *pickup* order at the counter (výdaj). The
// cash always lands in a courier's wallet (driver_id), never the admin's — so a
// pickup settled by an admin must be attributed to a driver. When exactly one
// driver is on shift the money goes to them automatically; otherwise the admin
// picks who took it.
export async function markDispatchPaid(
  id: string,
  walletDriverId?: string,
  card?: boolean
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireDispatcher();
  await ensureOrderColumns();
  const isAdmin = isAdminRole(ctx.role);

  if (isAdmin) {
    // An edited order that was already paid comes back through the kitchen —
    // handing it over again only flips the status (the payment already
    // happened, money untouched).
    const reissued = (await sql`
      UPDATE orders SET status = 'delivered'
      WHERE id = ${id} AND restaurant_id = ${ctx.restaurantId}
        AND fulfillment = 'pickup' AND COALESCE(paid, false) = true
        AND COALESCE(edited, false) = true AND status = 'ready'
      RETURNING id
    `) as { id: string }[];
    if (reissued.length) {
      await audit({
        action: "dispatch.reissued",
        actorId: ctx.userId,
        actorEmail: ctx.email,
        restaurantId: ctx.restaurantId,
        target: id,
      });
      return { ok: true };
    }
    // Card money isn't tied to a driver's cash wallet — no wallet needed.
    if (card) {
      const cardRows = (await sql`
        UPDATE orders
        SET paid = true, paid_at = now(), status = 'delivered', by_card = true
        WHERE id = ${id} AND restaurant_id = ${ctx.restaurantId}
          AND fulfillment = 'pickup' AND COALESCE(paid, false) = false
        RETURNING id`) as { id: string }[];
      if (!cardRows.length)
        return { ok: false, error: "Objednávku sa nepodarilo vydať." };
      await audit({
        action: "dispatch.paid",
        actorId: ctx.userId,
        actorEmail: ctx.email,
        restaurantId: ctx.restaurantId,
        target: id,
        meta: { role: ctx.role, card: true },
      });
      return { ok: true };
    }
    const drivers = await getShiftDriversInternal(ctx.restaurantId);
    const target = walletDriverId
      ? drivers.find((d) => d.id === walletDriverId)
      : drivers.length === 1
      ? drivers[0]
      : undefined;
    if (!target)
      return {
        ok: false,
        error:
          drivers.length === 0
            ? "Najprv prideľte rozvozcovi službu (Prevádzka)."
            : "Vyberte, kto objednávku prevzal.",
      };
    const paidRows = (await sql`
      UPDATE orders
      SET paid = true, paid_at = now(), status = 'delivered', by_card = false,
          driver_id = ${target.id}, driver_name = ${target.name}
      WHERE id = ${id} AND restaurant_id = ${ctx.restaurantId}
        AND fulfillment = 'pickup'
        AND COALESCE(paid, false) = false
      RETURNING id`) as { id: string }[];
    if (!paidRows.length)
      return { ok: false, error: "Objednávku sa nepodarilo vydať." };
    await audit({
      action: "dispatch.paid",
      actorId: ctx.userId,
      actorEmail: ctx.email,
      restaurantId: ctx.restaurantId,
      target: id,
      meta: { role: ctx.role, wallet: target.id },
    });
    return { ok: true };
  }

  const rows = (await sql`
        UPDATE orders
        SET paid = true, paid_at = now(), status = 'delivered',
            by_card = ${!!card}
        WHERE id = ${id} AND restaurant_id = ${ctx.restaurantId}
          AND driver_id = ${ctx.userId} AND COALESCE(paid, false) = false
        RETURNING id`) as { id: string }[];
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
    meta: { role: ctx.role, card: !!card },
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
  paid: boolean;
  pizzaCount: number; // real pizzas (excludes dough sides) — gates pol/pol
  edited: boolean; // order was modified — re-check what changed
  note: string | null;
  surcharge: number; // custom-request surcharge already included in `total`
  lines: { name: string; quantity: number; note?: string; polpol?: boolean }[];
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
           COALESCE(surcharge, 0)::float AS surcharge,
           lines, driver_id, COALESCE(paid, false) AS paid,
           COALESCE(pizza_count, 0)::int AS pizza_count,
           COALESCE(edited, false) AS edited, created_at,
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
    surcharge: number;
    lines: { name: string; quantity: number; note?: string; polpol?: boolean }[];
    driver_id: string | null;
    paid: boolean;
    pizza_count: number;
    edited: boolean;
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
    paid: o.paid,
    pizzaCount: o.pizza_count,
    edited: o.edited,
    note: o.note,
    surcharge: o.surcharge,
    lines: Array.isArray(o.lines) ? o.lines : [],
  }));
}

// Cook/admin toggles the custom-request surcharge (e.g. half-and-half pizza).
// Idempotent: `total` is adjusted by the delta so applying it twice is safe.
// Only allowed before the order is paid.
export async function setOrderSurcharge(
  id: string,
  on: boolean
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireKitchen();
  await ensureOrderColumns();
  const amount = on ? POL_POL_SURCHARGE : 0;
  const note = on ? POL_POL_LABEL : null;
  // Guards: pol/pol can't be added to a paid order, nor to one without a real
  // pizza (dough sides don't count). Removing it is always allowed.
  const chk = (await sql`
    SELECT COALESCE(paid, false) AS paid, COALESCE(pizza_count, 0)::int AS pc
    FROM orders WHERE id = ${id} AND restaurant_id = ${ctx.restaurantId} LIMIT 1
  `) as { paid: boolean; pc: number }[];
  if (!chk.length) return { ok: false, error: "Objednávka neexistuje." };
  if (chk[0].paid)
    return { ok: false, error: "Nedá sa upraviť — objednávka je už zaplatená." };
  if (on && chk[0].pc <= 0)
    return {
      ok: false,
      error: "Pol/pol sa dá pridať len k objednávke, ktorá obsahuje pizzu.",
    };
  const rows = (await sql`
    UPDATE orders
    SET total = total - COALESCE(surcharge, 0) + ${amount},
        surcharge = ${amount},
        surcharge_note = ${note}
    WHERE id = ${id} AND restaurant_id = ${ctx.restaurantId}
      AND COALESCE(paid, false) = false
    RETURNING id
  `) as { id: string }[];
  if (!rows.length)
    return { ok: false, error: "Nedá sa upraviť — objednávka je už zaplatená." };
  await audit({
    action: on ? "order.surcharge.added" : "order.surcharge.removed",
    actorId: ctx.userId,
    restaurantId: ctx.restaurantId,
    target: id,
  });
  return { ok: true };
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
// Call / counter board — a slim account that only sees finished orders and
// calls the customer. No other admin access.
// ===========================================================================
export interface CallContext {
  role: string;
  name: string;
  restaurantId: string;
  restaurantName: string;
}

export async function getCallContext(): Promise<CallContext | null> {
  const session = await auth();
  const role = session?.user?.role;
  if (
    !session?.user ||
    (role !== "call" && role !== "super_admin") ||
    !session.user.restaurantId
  )
    return null;
  const r = RESTAURANTS.find((x) => x.id === session.user.restaurantId);
  return {
    role: role!,
    name: session.user.name ?? "Telefón",
    restaurantId: session.user.restaurantId,
    restaurantName: r?.name ?? "Prevádzka",
  };
}

export interface CallOrder {
  id: string;
  fulfillment: string; // 'delivery' | 'pickup'
  customerName: string;
  phone: string;
  callable: boolean; // true only when `phone` is a real, dial-able number
  note: string | null;
  status: string;
  minsAgo: number;
  total: number;
  lines: { name: string; quantity: number }[];
}

// A phone field is dial-able only if it really is a number. Staff sometimes key
// a name instead (e.g. a regular they know) — those must never become a tel:
// link that would open the dialer with a name.
function isCallablePhone(phone: string | null): boolean {
  if (!phone) return false;
  const digits = phone.replace(/[^\d]/g, "");
  return digits.length >= 6; // shortest sensible SK number
}

// Finished ("done") orders the call account may ring the customer about:
// everything the kitchen has marked ready (or that's already on the way), not
// yet settled. Split by fulfillment on the client.
export async function getCallBoard(): Promise<CallOrder[]> {
  const session = await auth();
  const role = session?.user?.role;
  if (
    !session?.user ||
    (role !== "call" && role !== "super_admin") ||
    !session.user.restaurantId
  )
    throw new Error("Unauthorized");
  const restaurantId = session.user.restaurantId;
  await ensureOrderColumns();
  const rows = (await sql`
    SELECT id, fulfillment, customer_name, phone, note, status, lines,
           total::float AS total,
           EXTRACT(EPOCH FROM (now() - created_at))/60 AS mins_ago
    FROM orders
    WHERE restaurant_id = ${restaurantId}
      AND status IN ('ready', 'delivering')
      AND COALESCE(paid, false) = false
    ORDER BY created_at ASC
  `) as Array<{
    id: string;
    fulfillment: string;
    customer_name: string;
    phone: string;
    note: string | null;
    status: string;
    lines: { name: string; quantity: number }[];
    total: number;
    mins_ago: number;
  }>;
  return rows.map((o) => ({
    id: o.id,
    fulfillment: o.fulfillment,
    customerName: o.customer_name,
    phone: o.phone,
    callable: isCallablePhone(o.phone),
    note: o.note,
    status: o.status,
    minsAgo: Math.max(0, Math.round(o.mins_ago)),
    total: o.total,
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
    logError("createStaffOrder", e);
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
  // Admins don't manage live orders on the board — that's the courier's job.
  if (isAdminRole(ctx.role))
    return { ok: false, error: ADMIN_DISPATCH_BLOCKED };
  if (input.restaurantId !== ctx.restaurantId)
    return { ok: false, error: "Nesprávna prevádzka." };
  if (!Array.isArray(input.lines) || input.lines.length === 0)
    return { ok: false, error: "Objednávka musí mať aspoň jednu položku." };

  try {
    await ensureContent();
    await ensureOrderColumns();

    const existing = (await sql`
      SELECT driver_id, COALESCE(paid, false) AS paid
      FROM orders WHERE id = ${id} AND restaurant_id = ${ctx.restaurantId} LIMIT 1
    `) as { driver_id: string | null; paid: boolean }[];
    const ex = existing[0];
    if (!ex) return { ok: false, error: "Objednávka sa nenašla." };
    if (ex.paid)
      return { ok: false, error: "Zaplatenú objednávku nie je možné upraviť." };
    if (ex.driver_id !== ctx.userId)
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
    logError("updateStaffOrder", e);
    return { ok: false, error: "Zmeny sa nepodarilo uložiť." };
  }
}

// Admin edit of any order. Allowed while the order is not delivered & unpaid,
// or — for pickup — within 20 minutes of the first payment. The edited order
// goes back through the kitchen (status → received) with an "upravená" tag.
export async function adminUpdateOrder(
  id: string,
  input: StaffOrderInput
): Promise<CreateOrderResult> {
  const session = await requireAdmin(input.restaurantId);
  if (!Array.isArray(input.lines) || input.lines.length === 0)
    return { ok: false, error: "Objednávka musí mať aspoň jednu položku." };

  try {
    await ensureContent();
    await ensureOrderColumns();

    const existing = (await sql`
      SELECT status, fulfillment, COALESCE(paid, false) AS paid, paid_at,
             COALESCE(surcharge, 0)::float AS surcharge,
             lines, total::float AS total, edit_note
      FROM orders WHERE id = ${id} AND restaurant_id = ${input.restaurantId} LIMIT 1
    `) as Array<{
      status: string;
      fulfillment: string;
      paid: boolean;
      paid_at: string | null;
      surcharge: number;
      lines: CartLine[];
      total: number;
      edit_note: string | null;
    }>;
    const ex = existing[0];
    if (!ex) return { ok: false, error: "Objednávka sa nenašla." };
    const within20 =
      ex.paid_at != null &&
      Date.now() - new Date(ex.paid_at).getTime() < 20 * 60 * 1000;
    const editable =
      (ex.status !== "delivered" && !ex.paid) ||
      (ex.fulfillment === "pickup" && ex.paid && within20);
    if (!editable)
      return {
        ok: false,
        error:
          "Objednávku už nie je možné upraviť (doručená, alebo od zaplatenia prešlo viac ako 20 min).",
      };

    const products = await loadProducts();
    const usable = products.length ? products : PRODUCTS;
    const pizza = pizzaIds(usable);

    const lines: CartLine[] = [];
    for (const l of input.lines) {
      const priced = repriceLine(l as CartLine, usable, input.restaurantId, pizza);
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
    // Keep an existing pol/pol surcharge on top of the recomputed total.
    const total = round2(totals.total + ex.surcharge);
    const phone = (input.phone ?? "").trim();
    const name = (input.customerName ?? "").trim() || phone || "Objednávka";
    const note = input.note?.trim() ? input.note.trim() : null;

    // Summarise what changed (item quantities + total) so the kitchen and the
    // payment breakdown show exactly what the edit did.
    const qtyByName = (ls: CartLine[]) => {
      const m = new Map<string, number>();
      for (const l of Array.isArray(ls) ? ls : [])
        m.set(l.name, (m.get(l.name) ?? 0) + l.quantity);
      return m;
    };
    const before = qtyByName(ex.lines);
    const after = qtyByName(lines);
    const changes: string[] = [];
    for (const [n, q] of after) {
      const prev = before.get(n) ?? 0;
      if (q > prev) changes.push(`+${q - prev}× ${n}`);
      else if (q < prev) changes.push(`−${prev - q}× ${n}`);
    }
    for (const [n, q] of before) {
      if (!after.has(n)) changes.push(`−${q}× ${n}`);
    }
    if (Math.abs(round2(ex.total) - total) >= 0.005)
      changes.push(`suma ${eurText(ex.total)} → ${eurText(total)}`);
    const editNote = changes.length
      ? `Úprava: ${changes.join(", ")}`
      : ex.edit_note ?? "Úprava: bez zmeny položiek";

    await sql`
      UPDATE orders SET
        fulfillment = ${input.fulfillment},
        customer_name = ${name}, phone = ${phone},
        address = ${input.address ? JSON.stringify(input.address) : null},
        zone_name = ${zone?.name ?? null},
        lines = ${JSON.stringify(lines)}, pizza_count = ${pizzaCount(lines, pizza)},
        subtotal = ${totals.subtotal}, delivery_fee = ${totals.deliveryFee},
        discount = ${totals.discount}, total = ${total},
        note = ${note},
        edited = true, edit_note = ${editNote}, status = 'received'
      WHERE id = ${id} AND restaurant_id = ${input.restaurantId}
    `;
    await audit({
      action: "order.admin_edited",
      actorId: session.user.id,
      actorEmail: session.user.email,
      restaurantId: input.restaurantId,
      target: id,
      meta: { total },
    });
    return { ok: true, id, total };
  } catch (e) {
    logError("adminUpdateOrder", e);
    return { ok: false, error: "Zmeny sa nepodarilo uložiť." };
  }
}
