# 🔥 Pyro & Polomárik — Premium Pizza Ordering Platform

A modern, responsive, multi-restaurant pizza ordering platform for two
locations under one roof:

- **Pyro Pizzeria** — Kamenná Poruba
- **Polomárik** — Stráňavy

Built to feel like a premium blend of PizzaMania.sk, the Domino's ordering
flow, and Apple-level UI polish. Warm, wood-fired palette, glassmorphism where
it earns its place, soft shadows, rounded corners, and animated micro
interactions throughout.

> This README documents the **customer-facing interface** — everything a guest
> sees and does when ordering. Staff-only surfaces (kitchen, dispatch, admin)
> are intentionally out of scope here.

---

## ✨ The customer journey (working end-to-end)

The whole ordering flow runs live in the browser:

1. **Fullscreen restaurant selector** (first screen — *not* the menu). Large
   photo cards with address, opening hours, live **Open/Closed** status,
   estimated prep time, and **distance** when you allow geolocation. Picking a
   restaurant switches the entire app — menu, prices, zones, hours, branding,
   and even the **browser-tab favicon** (see below).
2. **Home** — cinematic hero with animated ingredients, feature strip,
   categories, bestseller grid, verified customer reviews, delivery CTA.
3. **Menu** — sticky category nav, instant search, filters (vegetarian, spicy,
   new, popular), price sorting, rich product cards with image, price, sizes,
   ingredients, allergens, availability and badges (recommended / spicy /
   vegetarian / new / bestseller). Categories: **pizza, burgers, club
   sandwiches, sides, and dressings / sauces**.
4. **Pizza Customizer** — size, extra cheese, stuffed crust, add/remove
   ingredients, quantity, kitchen note, **live-updating price**.
5. **Slide-out cart** — animated, quantity steppers, coupons
   (`PYRO10`, `FREEDELIVERY`, `HAPPY5`), estimated prep time, running total.
6. **Checkout** — delivery vs pickup, customer details, cash/card on
   pickup/delivery (no online payments), live order summary.
7. **Address Verification System** — enter street/house/city/ZIP → the app
   searches each restaurant's delivery-zone database and returns:
   - ✅ *We deliver here* with the zone's **minimum order**, **delivery fee**
     and **ETA**. If the zone has a minimum, checkout unlocks only once your
     subtotal meets it, with an "*add €X.XX more*" nudge until then.
   - ❌ *Outside every zone* → offers **pickup** or **switching restaurant**.
8. **Order tracking** — live status stepper (received → accepted → preparing →
   ready → delivering → delivered) that auto-advances.
9. **Account** — login / register / Google / Apple (mock), cross-device order
   history, reorder, and notification preferences.
10. Extras: dark mode, floating cart button, skeleton loaders, empty states,
    custom 404, PWA manifest, SEO metadata + Schema.org JSON-LD, OpenStreetMap
    contact map, Slovak copy throughout.

## 🚚 Delivery zones & minimum order

Each restaurant has its own delivery zones, and every zone carries a
**minimum order** amount. A zone with a `0 €` minimum has no limit; a zone set
to, say, `20 €` (e.g. **Rajec a okolie** for Pyro) will only let guests in that
zone check out once their subtotal reaches 20 €. The minimum is shown on the
address-verification result, enforced at checkout, and validated again
server-side so it can't be bypassed.

## 🖼️ Per-restaurant favicon

The browser-tab favicon follows the pizzeria you're currently browsing — a
**rounded version of that restaurant's logo** (Pyro or Polomárik). Before you
pick a restaurant, a neutral brand icon is shown.

## 🎨 Design system

| Token       | Value     | Use                    |
| ----------- | --------- | ---------------------- |
| Primary     | `#B22222` | deep pizza red         |
| Secondary   | `#E85D04` | wood-fired orange      |
| Accent      | `#F4C542` | golden cheese          |
| Dark        | `#191919` | dark surfaces          |
| Surface     | `#262626` | cards (dark)           |
| Background  | `#FFF8F1` | app background         |
| Success     | `#2E7D32` | open / confirmations   |
| Error       | `#C62828` | closed / no delivery   |

Rounded 18–24px corners, soft shadows, subtle gradients, glassmorphism on the
navbar and modals only.

## 🧱 Tech stack

- **Next.js 15** (App Router) · **React 19** · **TypeScript**
- **TailwindCSS** (custom design tokens) · **Framer Motion** (animations)
- **Zustand** (cart / restaurant / theme / orders, persisted to localStorage)
- **lucide-react** icons

The seed data layer (`src/lib/data.ts`) is a fully-typed source for both
restaurants — menus, prices, opening hours, and delivery zones — mirrored 1:1
by `prisma/schema.prisma`.

## 🚀 Getting started

```bash
npm install
npm run dev        # http://localhost:3000
# or
npm run build && npm run start
```

## 📁 Structure

```
src/
  app/            # routes: home, menu, offers, about, contact, delivery,
                  #         checkout, track, account, + manifest/404/loading
  components/     # Navbar, RestaurantModal, Cart, ProductCard, PizzaCustomizer,
                  # AddressVerification, Footer, Badges
  lib/            # types, data (seed), store (zustand), pricing, utils
prisma/           # reference PostgreSQL schema
```

---

*Menus, prices, opening hours, and delivery zones are configurable per
restaurant. Restaurant details use realistic public information as a starting
point.*
