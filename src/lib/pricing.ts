import type { CartLine, DeliveryZone } from "./types";
import { COUPONS } from "./data";

export function lineTotal(l: CartLine): number {
  return Math.round(l.unitPrice * l.quantity * 100) / 100;
}

export function subtotal(cart: CartLine[]): number {
  return Math.round(cart.reduce((s, l) => s + lineTotal(l), 0) * 100) / 100;
}

export interface Totals {
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  freeDelivery: boolean;
}

export function computeTotals(
  cart: CartLine[],
  restaurantId: string | null,
  zone: DeliveryZone | null,
  fulfillment: "delivery" | "pickup",
  couponCode: string | null
): Totals {
  const sub = subtotal(cart);
  let deliveryFee =
    fulfillment === "delivery" && zone ? zone.deliveryFee : 0;
  let discount = 0;
  let freeDelivery = false;

  if (couponCode) {
    const c = COUPONS.find(
      (x) =>
        x.code.toUpperCase() === couponCode.toUpperCase() &&
        (x.restaurantId === "all" || x.restaurantId === restaurantId) &&
        sub >= x.minSubtotal
    );
    if (c) {
      if (c.type === "percentage") discount = (sub * c.value) / 100;
      else if (c.type === "fixed") discount = c.value;
      else if (c.type === "free_delivery") {
        freeDelivery = true;
        deliveryFee = 0;
      }
    }
  }

  discount = Math.round(discount * 100) / 100;
  const total = Math.max(0, Math.round((sub + deliveryFee - discount) * 100) / 100);
  return { subtotal: sub, deliveryFee, discount, total, freeDelivery };
}
