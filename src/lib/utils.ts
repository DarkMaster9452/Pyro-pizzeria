import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Restaurant, DeliveryZone } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function eur(n: number): string {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

// Flyer-style numbering: pizzas are numbered 1..N in their menu (sort) order,
// keyed by product id so the number stays fixed regardless of sorting/filters.
export function pizzaNumbers(
  products: { id: string; category: string; restaurantId: string }[],
  restaurantId: string | null
): Record<string, number> {
  const map: Record<string, number> = {};
  let n = 0;
  for (const p of products) {
    if (p.restaurantId === restaurantId && p.category === "pizza")
      map[p.id] = ++n;
  }
  return map;
}

// Flyer numbers of items that sit in the "pizza" category but are NOT real
// pizzas — dough sides (pizza sticks / stuffed sticks / knots), numbers 21–23.
// They keep their number on the menu but don't count toward the pizza queue and
// can't be made pol/pol.
export const NON_PIZZA_FLYER_NUMBERS = new Set([21, 22, 23]);

// Whether a product counts as a real pizza (for the pizza queue count and the
// pol/pol option). Non-pizza categories are never pizzas; a pizza-category item
// is a real pizza unless its flyer number is one of the dough-side numbers.
export function isRealPizza(
  product: { category: string },
  flyerNumber: number | undefined
): boolean {
  if (product.category !== "pizza") return false;
  return flyerNumber == null || !NON_PIZZA_FLYER_NUMBERS.has(flyerNumber);
}

// Join address parts, skipping the empty ones (staff may type a single line).
export function formatAddress(
  a?: {
    street?: string;
    houseNumber?: string;
    city?: string;
    zip?: string;
  } | null
): string {
  if (!a) return "";
  const line1 = [a.street, a.houseNumber].filter(Boolean).join(" ").trim();
  const line2 = [a.zip, a.city].filter(Boolean).join(" ").trim();
  return [line1, line2].filter(Boolean).join(", ");
}

// JS getDay(): 0=Sun..6=Sat -> convert to our 0=Mon..6=Sun
export function jsDayToIndex(jsDay: number): number {
  return (jsDay + 6) % 7;
}

export interface OpenState {
  open: boolean;
  label: string;
  closesAt?: string;
  opensAt?: string;
}

export function getOpenState(r: Restaurant, now = new Date()): OpenState {
  const idx = jsDayToIndex(now.getDay());
  const today = r.openingHours.find((h) => h.day === idx);
  if (!today || today.closed) {
    return { open: false, label: "Zatvorené" };
  }
  const mins = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = today.open.split(":").map(Number);
  const [ch, cm] = today.close.split(":").map(Number);
  const openMin = oh * 60 + om;
  const closeMin = ch * 60 + cm;
  if (mins >= openMin && mins < closeMin) {
    return { open: true, label: "Otvorené", closesAt: today.close };
  }
  return { open: false, label: "Zatvorené", opensAt: today.open };
}

// Haversine distance in km
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export interface ZoneMatch {
  zone: DeliveryZone | null;
  matchedArea?: string;
}

// Match a street/city string against a restaurant's delivery zones.
export function findZone(r: Restaurant, query: string): ZoneMatch {
  const q = normalize(query);
  if (!q) return { zone: null };
  for (const zone of r.deliveryZones) {
    for (const area of zone.areas) {
      const a = normalize(area);
      if (q.includes(a) || a.includes(q)) {
        return { zone, matchedArea: area };
      }
    }
  }
  return { zone: null };
}

export function shortId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// Dynamic kitchen wait: base prep time grows with the number of pizzas in the
// queue. ~1.5 min per pizza => 10 pizzas adds ~15 min (base 45 → ≈1 hodina).
export function estimatedWait(baseMinutes: number, queuePizzas: number): number {
  const raw = baseMinutes + queuePizzas * 1.5;
  return Math.round(raw / 5) * 5; // round to a friendly 5-min step
}

// Preset surcharge for a custom request (half-and-half pizza etc.), toggled by
// the cook or admin on an order. Kept here (not in the "use server" module) so
// both server actions and client components can import it.
export const POL_POL_SURCHARGE = 1.5;
export const POL_POL_LABEL = "Pol/pol pizza";

// Part-timer (brigádnik) hourly wage, paid out daily in the settlement.
export const WAGE_PER_HOUR = 6;

// First-letter initials of a driver (e.g. "Daniel Pekný" → "DP"), shown as a
// small avatar next to their name across the admin and dispatch board.
export function driverInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// Give each driver a stable, distinct colour (hashed from their name) so the
// same person reads the same everywhere in the admin and on the dispatch board.
const DRIVER_COLORS = [
  "#E85D04", "#2E7D32", "#1565C0", "#6A1B9A",
  "#00838F", "#C2185B", "#B8860B", "#4E342E",
];
export function driverColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return DRIVER_COLORS[h % DRIVER_COLORS.length];
}
