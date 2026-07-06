"use server";

import { sql } from "./db";
import { auth } from "@/auth";
import { registerUser } from "./users";
import { RESTAURANTS, PRODUCTS } from "./data";
import { estimatedWait, shortId } from "./utils";
import type { CartLine, FulfillmentType, CustomerAddress } from "./types";

const PIZZA_IDS = new Set(
  PRODUCTS.filter((p) => p.category === "pizza").map((p) => p.id)
);

function pizzaCount(lines: CartLine[]): number {
  return lines.reduce(
    (n, l) => n + (PIZZA_IDS.has(l.productId) ? l.quantity : 0),
    0
  );
}

// -------- Registration --------
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

// -------- Create order (checkout) --------
export interface NewOrderInput {
  restaurantId: string;
  fulfillment: FulfillmentType;
  customerName: string;
  phone: string;
  email?: string;
  address?: CustomerAddress;
  zoneName?: string;
  lines: CartLine[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  payment: string;
  note?: string;
  eta: number;
}

export async function createOrder(
  input: NewOrderInput
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const state = (await sql`
      SELECT sold_out FROM restaurant_state WHERE id = ${input.restaurantId} LIMIT 1
    `) as { sold_out: boolean }[];
    if (state[0]?.sold_out) {
      return { ok: false, error: "Prevádzka je momentálne vypredaná." };
    }
    const id = shortId();
    const pc = pizzaCount(input.lines);
    await sql`
      INSERT INTO orders (
        id, restaurant_id, status, fulfillment, customer_name, phone, email,
        address, zone_name, lines, pizza_count, subtotal, delivery_fee,
        discount, total, payment, note, eta
      ) VALUES (
        ${id}, ${input.restaurantId}, 'received', ${input.fulfillment},
        ${input.customerName}, ${input.phone}, ${input.email ?? null},
        ${input.address ? JSON.stringify(input.address) : null},
        ${input.zoneName ?? null}, ${JSON.stringify(input.lines)}, ${pc},
        ${input.subtotal}, ${input.deliveryFee}, ${input.discount},
        ${input.total}, ${input.payment}, ${input.note ?? null}, ${input.eta}
      )
    `;
    return { ok: true, id };
  } catch (e) {
    console.error("createOrder failed", e);
    return { ok: false, error: "Objednávku sa nepodarilo uložiť." };
  }
}

// -------- Admin: context for the logged-in admin --------
export async function getAdminContext(): Promise<{
  restaurantId: string;
  name: string;
  email: string;
} | null> {
  const session = await auth();
  if (session?.user?.role !== "admin" || !session.user.restaurantId)
    return null;
  return {
    restaurantId: session.user.restaurantId,
    name: session.user.name ?? "Admin",
    email: session.user.email ?? "",
  };
}

// -------- Admin: guard helper --------
async function requireAdmin(restaurantId: string) {
  const session = await auth();
  if (session?.user?.role !== "admin") throw new Error("Unauthorized");
  if (session.user.restaurantId !== restaurantId)
    throw new Error("Forbidden restaurant");
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

  // Local-noon boundary (reset at 12:00 the next day) in Bratislava time.
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
  await requireAdmin(restaurantId);
  await sql`
    UPDATE restaurant_state SET sold_out = ${value}, updated_at = now()
    WHERE id = ${restaurantId}
  `;
  return { ok: true };
}

export async function setOrderStatus(
  restaurantId: string,
  id: string,
  status: string
) {
  await requireAdmin(restaurantId);
  await sql`
    UPDATE orders SET status = ${status}
    WHERE id = ${id} AND restaurant_id = ${restaurantId}
  `;
  return { ok: true };
}
