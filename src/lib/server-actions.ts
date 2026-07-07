"use server";

import { sql } from "./db";
import { auth } from "@/auth";
import { registerUser, getSessionVersion } from "./users";
import {
  RESTAURANTS,
  PRODUCTS,
  EXTRA_INGREDIENTS,
  EXTRA_CHEESE_PRICE,
  STUFFED_CRUST_PRICE,
} from "./data";
import { computeTotals } from "./pricing";
import { estimatedWait, shortId, findZone } from "./utils";
import { orderInputSchema, firstError } from "./validation";
import { rateLimit, audit, clientIp } from "./security";
import type { CartLine, DeliveryZone } from "./types";

const PIZZA_IDS = new Set(
  PRODUCTS.filter((p) => p.category === "pizza").map((p) => p.id)
);
const round2 = (n: number) => Math.round(n * 100) / 100;

function pizzaCount(lines: CartLine[]): number {
  return lines.reduce(
    (n, l) => n + (PIZZA_IDS.has(l.productId) ? l.quantity : 0),
    0
  );
}

// Re-price a cart line from the DATABASE/menu — the client's unitPrice is
// discarded. Returns null for an unknown product.
function repriceLine(line: CartLine, restaurantId: string): CartLine | null {
  const product = PRODUCTS.find(
    (p) => p.id === line.productId && p.restaurantId === restaurantId
  );
  if (!product || !product.available) return null;
  const size =
    product.sizes.find((s) => s.id === line.sizeId) ?? product.sizes[0];
  let unit = product.basePrice + size.priceDelta;
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
    sizeLabel: size.label,
    unitPrice: round2(unit),
    quantity: Math.min(50, Math.max(1, Math.floor(line.quantity))),
  };
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
}

export interface CreateOrderResult {
  ok: boolean;
  id?: string;
  error?: string;
  total?: number;
  eta?: number;
}

export async function createOrder(
  input: NewOrderInput
): Promise<CreateOrderResult> {
  // 1) validate shape
  const parsed = orderInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const data = parsed.data;

  // 2) rate limit
  const ip = await clientIp();
  const rl = await rateLimit("order", ip, 12, 10 * 60);
  if (!rl.allowed)
    return { ok: false, error: "Príliš veľa objednávok. Skúste o chvíľu." };

  const restaurant = RESTAURANTS.find((r) => r.id === data.restaurantId);
  if (!restaurant) return { ok: false, error: "Neznáma prevádzka." };

  try {
    // 3) sold-out (authoritative, from DB)
    const state = (await sql`
      SELECT sold_out FROM restaurant_state WHERE id = ${data.restaurantId} LIMIT 1
    `) as { sold_out: boolean }[];
    if (state[0]?.sold_out)
      return { ok: false, error: "Prevádzka je momentálne vypredaná." };

    // 4) re-price every line from the menu (ignore client prices)
    const lines: CartLine[] = [];
    for (const l of data.lines) {
      const priced = repriceLine(l as CartLine, data.restaurantId);
      if (!priced)
        return { ok: false, error: "Niektorý produkt už nie je dostupný." };
      lines.push(priced);
    }

    // 5) resolve delivery zone + fee server-side
    let zone: DeliveryZone | null = null;
    if (data.fulfillment === "delivery") {
      if (!data.address)
        return { ok: false, error: "Chýba adresa doručenia." };
      zone = findZone(
        restaurant,
        `${data.address.street} ${data.address.city}`
      ).zone;
      if (!zone)
        return { ok: false, error: "Na túto adresu nedoručujeme." };
    }

    // 6) authoritative totals (server-computed discounts/fees/total)
    const totals = computeTotals(
      lines,
      data.restaurantId,
      zone,
      data.fulfillment,
      data.couponCode ?? null
    );

    // 7) enforce delivery minimum
    if (zone && totals.subtotal < zone.minimumOrder) {
      return {
        ok: false,
        error: `Minimálna objednávka pre rozvoz je ${zone.minimumOrder} €.`,
      };
    }

    // 8) ETA from current kitchen load
    const pending = (await sql`
      SELECT COALESCE(SUM(pizza_count),0)::int AS p FROM orders
      WHERE restaurant_id = ${data.restaurantId}
        AND status IN ('received','accepted','preparing')
    `) as { p: number }[];
    const wait = estimatedWait(
      restaurant.prepTimeMinutes,
      (pending[0]?.p ?? 0) + pizzaCount(lines)
    );
    const eta = zone ? Math.max(zone.estimatedMinutes, wait) : wait;

    const id = shortId();
    await sql`
      INSERT INTO orders (
        id, restaurant_id, status, fulfillment, customer_name, phone, email,
        address, zone_name, lines, pizza_count, subtotal, delivery_fee,
        discount, total, payment, note, eta
      ) VALUES (
        ${id}, ${data.restaurantId}, 'received', ${data.fulfillment},
        ${data.customerName}, ${data.phone}, ${data.email || null},
        ${data.address ? JSON.stringify(data.address) : null},
        ${zone?.name ?? null}, ${JSON.stringify(lines)}, ${pizzaCount(lines)},
        ${totals.subtotal}, ${totals.deliveryFee}, ${totals.discount},
        ${totals.total},
        ${data.fulfillment === "delivery" ? "Platba pri doručení" : "Platba pri odbere"},
        ${data.note || null}, ${eta}
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
  // enforce "logout from all devices" revocation
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
  lines: { name: string; quantity: number }[];
}

export interface AdminSummary {
  soldOut: boolean;
  pendingCount: number;
  pendingPizzas: number;
  waitMinutes: number;
  soldToday: number;
  ordersToday: number;
  revenueToday: number;
  orders: AdminOrderRow[];
}

export async function getAdminSummary(
  restaurantId: string
): Promise<AdminSummary> {
  await requireAdmin(restaurantId);
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

  const orderRows = (await sql`
    SELECT id, status, fulfillment, customer_name, total::float AS total,
           pizza_count, lines,
           EXTRACT(EPOCH FROM (now() - created_at))/60 AS mins_ago
    FROM orders
    WHERE restaurant_id = ${restaurantId}
    ORDER BY created_at DESC
    LIMIT 30
  `) as Array<{
    id: string;
    status: string;
    fulfillment: string;
    customer_name: string;
    total: number;
    pizza_count: number;
    lines: { name: string; quantity: number }[];
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
    orders: orderRows.map((o) => ({
      id: o.id,
      status: o.status,
      fulfillment: o.fulfillment,
      customerName: o.customer_name,
      total: o.total,
      pizzaCount: o.pizza_count,
      minsAgo: Math.max(0, Math.round(o.mins_ago)),
      lines: Array.isArray(o.lines) ? o.lines : [],
    })),
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
