# 🔥 Pyro & Polomárik — Premium Pizza Ordering Platform

A modern, responsive, multi-restaurant pizza ordering platform for two
locations under one roof:

- **Pyro Pizzeria** — Kamenná Poruba
- **Polomárik** — Stráňavy

Built to feel like a premium blend of PizzaMania.sk, the Domino's ordering
flow, and Apple-level UI polish. Warm, wood-fired palette, glassmorphism where
it earns its place, soft shadows, rounded corners, and animated micro
interactions throughout.

---

## ✨ What's implemented (working end-to-end)

The whole customer journey runs live in the browser — no backend required:

1. **Fullscreen restaurant selector** (first screen — *not* the menu). Large
   photo cards with address, opening hours, live **Open/Closed** status,
   estimated prep time, and **distance** when you allow geolocation. Picking a
   restaurant switches the entire app — menu, prices, zones, hours, branding.
2. **Home** — cinematic hero with animated ingredients, feature strip,
   categories, bestseller grid, verified customer reviews, delivery CTA.
3. **Menu** — sticky category nav, instant search, filters (vegetarian, spicy,
   new, popular), price sorting, rich product cards with image, price, sizes,
   ingredients, allergens, availability and badges (recommended / spicy /
   vegetarian / new / bestseller).
4. **Pizza Customizer** — size, extra cheese, stuffed crust, add/remove
   ingredients, quantity, kitchen note, **live-updating price**.
5. **Slide-out cart** — animated, quantity steppers, coupons
   (`PYRO10`, `FREEDELIVERY`, `HAPPY5`), estimated prep time, minimum-order
   notice, running total.
6. **Checkout** — delivery vs pickup, customer details, cash/card on
   pickup/delivery (no online payments), live order summary.
7. **Address Verification System** — enter street/house/city/ZIP → the app
   searches each restaurant's delivery-zone database and returns:
   - ✅ *We deliver here* with **minimum order**, **delivery fee**, **ETA**, and
     a "*add €X.XX more to qualify*" nudge; checkout unlocks only when the
     minimum is met.
   - ❌ *Outside every zone* → offers **pickup** or **switching restaurant**.
8. **Order tracking** — live status stepper (received → accepted → preparing →
   ready → delivering → delivered) that auto-advances.
9. **Admin Panel** (`/admin`) — Stripe/Linear-style dark dashboard:
   - **Dashboard**: today's/monthly sales, avg order, returning customers,
     weekly revenue bar chart, monthly sparkline, top pizzas, order heatmap.
   - **Kitchen Display (KDS)**: incoming order cards, accept → preparing →
     ready → delivered, sound toggle.
   - **Orders**, **Products** (editable price + availability toggle),
     **Restaurants** (independent settings), **Coupons**, **Reviews**.
   - **Delivery Zones**: fully **editable** — min order, delivery fee, ETA, and
     add/remove streets/villages per zone; add new zones. Ready for street
     import and future GPS polygons.
10. **Account** — login / register / Google / Apple (mock), order history,
    favorites, reorder, notification preferences.
11. Extras: dark/light mode, floating cart button, skeleton loaders, empty
    states, custom 404, PWA manifest, SEO metadata + Schema.org JSON-LD,
    OpenStreetMap contact map, three-language-ready copy (currently SK).

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
- **lucide-react** icons · dependency-free SVG charts for the dashboard

The data layer (`src/lib/data.ts`) is a fully-typed, editable seed for both
restaurants — menus, prices, opening hours, and delivery zones. Everything the
admin edits maps 1:1 to `prisma/schema.prisma`, so making it production-backed
is a matter of swapping the in-memory reads for Prisma queries / Server Actions.

## 🚀 Getting started

```bash
npm install
npm run dev        # http://localhost:3000
# or
npm run build && npm run start
```

## 🔑 Demo prístupy — rozvoz (Pyro)

Jednoduché demo účty pre panel rozvozcu (`/rozvoz`). Po prihlásení sa kuriérovi
otvorí rovno panel rozvozu.

| Meno            | Prihlásenie (email) | Heslo    |
| --------------- | ------------------- | -------- |
| Daniel Pekný    | `daniel@pyro.sk`    | `daniel` |
| Tomáš Kavecký   | `tomas@pyro.sk`     | `tomas`  |
| Martin Straňanek| `martin@pyro.sk`    | `martin` |

> Iba na ukážku — pred ostrým nasadením heslá zmeňte.

## 🔌 Wiring the real backend (optional)

Everything below is scaffolded and documented rather than hard-wired, so the
app runs anywhere with zero configuration:

- **Database**: `prisma/schema.prisma` mirrors the data model. Run
  `npx prisma migrate dev`, seed from `src/lib/data.ts`, then replace the
  imports in the page/store code with Prisma calls inside Server Actions.
- **Auth**: NextAuth with Google/Apple providers (`.env.example`).
- **Maps**: Mapbox / Google Maps / Leaflet for address autocomplete and GPS
  delivery-zone polygons (the zone model already has a `polygon Json?` field).
- **Media**: UploadThing / Cloudinary for gallery + product images.
- **Notifications**: Twilio (SMS) + Resend (email) + Web Push.

## 📁 Structure

```
src/
  app/            # routes: home, menu, offers, about, contact, delivery,
                  #         checkout, track, account, admin, + manifest/404/loading
  components/     # Navbar, RestaurantModal, Cart, ProductCard, PizzaCustomizer,
                  # AddressVerification, Footer, Badges, admin/AdminCharts
  lib/            # types, data (seed), store (zustand), pricing, utils
prisma/           # reference PostgreSQL schema
```

---

*Menus, prices, opening hours, and delivery zones are all editable through the
admin panel. Restaurant details use realistic public information as a starting
point and are fully configurable.*
