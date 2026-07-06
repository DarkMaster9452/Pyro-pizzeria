"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartLine, Order } from "./types";

interface AppState {
  // restaurant selection
  restaurantId: string | null;
  setRestaurant: (id: string) => void;
  clearRestaurant: () => void;

  // theme
  theme: "light" | "dark";
  toggleTheme: () => void;

  // cart
  cart: CartLine[];
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  addLine: (line: CartLine) => void;
  updateQty: (lineId: string, qty: number) => void;
  removeLine: (lineId: string) => void;
  clearCart: () => void;

  // coupon
  coupon: string | null;
  setCoupon: (code: string | null) => void;

  // favorites
  favorites: string[];
  toggleFavorite: (productId: string) => void;

  // orders (order history + tracking)
  orders: Order[];
  addOrder: (order: Order) => void;
  updateOrderStatus: (id: string, status: Order["status"]) => void;
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      restaurantId: null,
      setRestaurant: (id) => set({ restaurantId: id }),
      clearRestaurant: () => set({ restaurantId: null, cart: [], coupon: null }),

      theme: "light",
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),

      cart: [],
      cartOpen: false,
      setCartOpen: (v) => set({ cartOpen: v }),
      addLine: (line) =>
        set((s) => ({ cart: [...s.cart, line], cartOpen: true })),
      updateQty: (lineId, qty) =>
        set((s) => ({
          cart: s.cart
            .map((l) => (l.lineId === lineId ? { ...l, quantity: qty } : l))
            .filter((l) => l.quantity > 0),
        })),
      removeLine: (lineId) =>
        set((s) => ({ cart: s.cart.filter((l) => l.lineId !== lineId) })),
      clearCart: () => set({ cart: [], coupon: null }),

      coupon: null,
      setCoupon: (code) => set({ coupon: code }),

      favorites: [],
      toggleFavorite: (productId) =>
        set((s) => ({
          favorites: s.favorites.includes(productId)
            ? s.favorites.filter((f) => f !== productId)
            : [...s.favorites, productId],
        })),

      orders: [],
      addOrder: (order) => set((s) => ({ orders: [order, ...s.orders] })),
      updateOrderStatus: (id, status) =>
        set((s) => ({
          orders: s.orders.map((o) => (o.id === id ? { ...o, status } : o)),
        })),
    }),
    { name: "pyro-platform" }
  )
);
