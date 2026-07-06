"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { RESTAURANTS, PRODUCTS, COUPONS, REVIEWS } from "@/lib/data";
import type { DeliveryZone, Product, OrderStatus } from "@/lib/types";
import { eur, cn, estimatedWait } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { BarChart, Sparkline, Heatmap } from "@/components/admin/AdminCharts";
import {
  LayoutDashboard,
  ShoppingBag,
  Pizza,
  Store,
  MapPin,
  Ticket,
  Star,
  ChefHat,
  TrendingUp,
  Euro,
  Users,
  Clock,
  Plus,
  Minus,
  Trash2,
  ArrowLeft,
  Bell,
  Volume2,
  Sun,
  Moon,
  Power,
  Timer,
} from "lucide-react";

type Tab =
  | "dashboard"
  | "kitchen"
  | "orders"
  | "products"
  | "restaurants"
  | "zones"
  | "coupons"
  | "reviews";

const NAV: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Prehľad", icon: <LayoutDashboard className="h-5 w-5" /> },
  { id: "kitchen", label: "Kuchyňa (KDS)", icon: <ChefHat className="h-5 w-5" /> },
  { id: "orders", label: "Objednávky", icon: <ShoppingBag className="h-5 w-5" /> },
  { id: "products", label: "Produkty", icon: <Pizza className="h-5 w-5" /> },
  { id: "restaurants", label: "Prevádzky", icon: <Store className="h-5 w-5" /> },
  { id: "zones", label: "Rozvozové zóny", icon: <MapPin className="h-5 w-5" /> },
  { id: "coupons", label: "Kupóny", icon: <Ticket className="h-5 w-5" /> },
  { id: "reviews", label: "Recenzie", icon: <Star className="h-5 w-5" /> },
];

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [restaurantId, setRestaurantId] = useState(RESTAURANTS[0].id);
  const restaurant = RESTAURANTS.find((r) => r.id === restaurantId)!;

  return (
    <div className="flex min-h-screen bg-[#f4f4f5] dark:bg-[#0f0f0f] text-neutral-800 dark:text-neutral-200">
      {/* sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-black/[0.08] dark:border-white/5 bg-white dark:bg-[#161616] lg:flex">
        <div className="flex items-center gap-2 border-b border-black/[0.08] dark:border-white/5 p-5">
          <span className="text-2xl">🔥</span>
          <div>
            <p className="font-display font-extrabold text-neutral-900 dark:text-white">Admin Panel</p>
            <p className="text-xs text-neutral-500">Multi-restaurant</p>
          </div>
        </div>
        <select
          value={restaurantId}
          onChange={(e) => setRestaurantId(e.target.value)}
          className="m-4 rounded-xl border border-black/10 dark:border-white/10 bg-neutral-100 dark:bg-[#222] px-3 py-2 text-sm outline-none"
        >
          {RESTAURANTS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setTab(n.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                tab === n.id
                  ? "bg-brand-primary text-white"
                  : "text-neutral-500 dark:text-neutral-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-white"
              )}
            >
              {n.icon}
              {n.label}
            </button>
          ))}
        </nav>
        <Link
          href="/"
          className="m-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-neutral-400 hover:bg-black/5 dark:hover:bg-white/5"
        >
          <ArrowLeft className="h-4 w-4" /> Späť na web
        </Link>
      </aside>

      {/* mobile tabs */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-black/10 dark:border-white/10 bg-white dark:bg-[#161616] p-1 lg:hidden">
        {NAV.slice(0, 5).map((n) => (
          <button
            key={n.id}
            onClick={() => setTab(n.id)}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-lg p-2 text-[10px]",
              tab === n.id ? "text-brand-secondary" : "text-neutral-500"
            )}
          >
            {n.icon}
            {n.label.split(" ")[0]}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-x-hidden p-5 pb-24 lg:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-neutral-900 dark:text-white">
              {NAV.find((n) => n.id === tab)?.label}
            </h1>
            <p className="text-sm text-neutral-500">{restaurant.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button className="rounded-full bg-black/[0.06] dark:bg-white/5 p-2.5 text-neutral-500 dark:text-neutral-400">
              <Bell className="h-5 w-5" />
            </button>
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary" />
          </div>
        </div>

        <OperationsBar restaurantId={restaurantId} />

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {tab === "dashboard" && <Dashboard />}
            {tab === "kitchen" && <Kitchen />}
            {tab === "orders" && <Orders />}
            {tab === "products" && <Products restaurantId={restaurantId} />}
            {tab === "restaurants" && <Restaurants restaurantId={restaurantId} />}
            {tab === "zones" && <Zones restaurantId={restaurantId} />}
            {tab === "coupons" && <Coupons />}
            {tab === "reviews" && <Reviews />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// ---------------- THEME TOGGLE (admin only) ----------------
function ThemeToggle() {
  const theme = useApp((s) => s.theme);
  const toggleTheme = useApp((s) => s.toggleTheme);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <button
      onClick={toggleTheme}
      aria-label="Prepnúť svetlý/tmavý režim"
      className="rounded-full bg-black/[0.06] dark:bg-white/5 p-2.5 text-neutral-500 dark:text-neutral-300 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
    >
      {mounted && theme === "dark" ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  );
}

// ---------------- OPERATIONS (sold-out + kitchen load) ----------------
function OperationsBar({ restaurantId }: { restaurantId: string }) {
  const restaurant = RESTAURANTS.find((r) => r.id === restaurantId)!;
  const soldOut = useApp((s) => s.soldOut[restaurantId] ?? false);
  const setSoldOut = useApp((s) => s.setSoldOut);
  const queue = useApp((s) => s.kitchenQueue[restaurantId] ?? 0);
  const setKitchenQueue = useApp((s) => s.setKitchenQueue);
  const wait = estimatedWait(restaurant.prepTimeMinutes, queue);

  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-2">
      {/* Sold-out control */}
      <div
        className={cn(
          "flex items-center justify-between gap-4 rounded-2xl border p-5 transition-colors",
          soldOut
            ? "border-brand-error/40 bg-brand-error/10"
            : "border-black/[0.08] bg-white dark:border-white/5 dark:bg-[#1a1a1a]"
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl",
              soldOut
                ? "bg-brand-error/15 text-brand-error"
                : "bg-brand-success/15 text-brand-success"
            )}
          >
            <Power className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold text-neutral-900 dark:text-white">
              {soldOut ? "Objednávky pozastavené" : "Prijímame objednávky"}
            </p>
            <p className="text-sm text-neutral-500">
              {soldOut
                ? "Zákazníci nemôžu objednávať (do vypredania)."
                : "Prepnutím pozastavíte objednávky na webe."}
            </p>
          </div>
        </div>
        <button
          onClick={() => setSoldOut(restaurantId, !soldOut)}
          className={cn(
            "shrink-0 rounded-full px-5 py-2.5 text-sm font-bold text-white transition-colors",
            soldOut
              ? "bg-brand-success hover:brightness-110"
              : "bg-brand-error hover:brightness-110"
          )}
        >
          {soldOut ? "Znovu otvoriť" : "Vypredané"}
        </button>
      </div>

      {/* Kitchen load / dynamic wait */}
      <div className="rounded-2xl border border-black/[0.08] bg-white p-5 dark:border-white/5 dark:bg-[#1a1a1a]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-accent/15 text-brand-accent">
              <Timer className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-neutral-900 dark:text-white">
                Vyťaženie kuchyne
              </p>
              <p className="text-sm text-neutral-500">
                Pizze v poradí určujú čakaciu dobu.
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-extrabold text-brand-primary">
              ~{wait} min
            </p>
            <p className="text-xs text-neutral-500">odhad. čakanie</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm text-neutral-500">Pizze v poradí</span>
          <div className="flex items-center gap-2 rounded-full bg-black/[0.05] p-1 dark:bg-white/5">
            <button
              onClick={() => setKitchenQueue(restaurantId, queue - 1)}
              className="rounded-full bg-white p-1.5 text-neutral-700 shadow-sm dark:bg-[#333] dark:text-white"
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              type="number"
              value={queue}
              onChange={(e) =>
                setKitchenQueue(restaurantId, Number(e.target.value) || 0)
              }
              className="w-14 bg-transparent text-center font-bold text-neutral-900 outline-none dark:text-white"
            />
            <button
              onClick={() => setKitchenQueue(restaurantId, queue + 1)}
              className="rounded-full bg-white p-1.5 text-neutral-700 shadow-sm dark:bg-[#333] dark:text-white"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <span className="text-xs text-neutral-400">
            napr. 10 pizz ≈ 60 min
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------- DASHBOARD ----------------
function Dashboard() {
  const stats = [
    { label: "Dnešné tržby", value: "€642", delta: "+12%", icon: <Euro /> },
    { label: "Objednávky dnes", value: "48", delta: "+8%", icon: <ShoppingBag /> },
    { label: "Priemerná objednávka", value: "€13.4", delta: "+3%", icon: <TrendingUp /> },
    { label: "Vracajúci sa zákazníci", value: "63%", delta: "+5%", icon: <Users /> },
  ];
  const week = [
    { label: "Po", value: 420 },
    { label: "Ut", value: 380 },
    { label: "St", value: 510 },
    { label: "Št", value: 470 },
    { label: "Pi", value: 720 },
    { label: "So", value: 890 },
    { label: "Ne", value: 640 },
  ];
  const heat = Array.from({ length: 7 }, () =>
    Array.from({ length: 13 }, () => Math.floor(Math.random() * 20))
  );
  const topPizzas = [
    { name: "Margherita", value: 128 },
    { name: "Diavola", value: 96 },
    { name: "Pyro Special", value: 84 },
    { name: "Prosciutto", value: 72 },
    { name: "Quattro Formaggi", value: 51 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-white dark:bg-[#1a1a1a] p-5 ring-1 ring-black/[0.06] dark:ring-white/5">
            <div className="flex items-center justify-between">
              <span className="rounded-xl bg-brand-primary/15 p-2 text-brand-secondary">
                {s.icon}
              </span>
              <span className="text-xs font-semibold text-brand-success">
                {s.delta}
              </span>
            </div>
            <p className="mt-3 font-display text-2xl font-extrabold text-neutral-900 dark:text-white">
              {s.value}
            </p>
            <p className="text-sm text-neutral-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl bg-white dark:bg-[#1a1a1a] p-5 ring-1 ring-black/[0.06] dark:ring-white/5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display font-bold text-neutral-900 dark:text-white">Tržby za týždeň</h3>
            <span className="text-sm text-neutral-500">€3 990 spolu</span>
          </div>
          <BarChart data={week} />
        </div>
        <div className="rounded-2xl bg-white dark:bg-[#1a1a1a] p-5 ring-1 ring-black/[0.06] dark:ring-white/5">
          <h3 className="mb-2 font-display font-bold text-neutral-900 dark:text-white">
            Mesačný trend
          </h3>
          <Sparkline data={[12, 18, 15, 22, 19, 26, 24, 30, 28, 34, 31, 40]} />
          <p className="mt-2 text-sm text-neutral-500">
            +34% oproti minulému mesiacu
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white dark:bg-[#1a1a1a] p-5 ring-1 ring-black/[0.06] dark:ring-white/5">
          <h3 className="mb-4 font-display font-bold text-neutral-900 dark:text-white">
            Najpredávanejšie pizze
          </h3>
          <div className="space-y-3">
            {topPizzas.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3">
                <span className="w-5 text-sm font-bold text-neutral-500">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm">{p.name}</span>
                <div className="h-2 w-32 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/5">
                  <div
                    className="h-full bg-gradient-to-r from-brand-primary to-brand-secondary"
                    style={{ width: `${(p.value / 128) * 100}%` }}
                  />
                </div>
                <span className="w-10 text-right text-sm text-neutral-400">
                  {p.value}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-white dark:bg-[#1a1a1a] p-5 ring-1 ring-black/[0.06] dark:ring-white/5">
          <h3 className="mb-4 flex items-center gap-2 font-display font-bold text-neutral-900 dark:text-white">
            <Clock className="h-4 w-4" /> Heatmapa objednávok (špičky)
          </h3>
          <Heatmap grid={heat} />
        </div>
      </div>
    </div>
  );
}

// ---------------- KITCHEN DISPLAY ----------------
const KITCHEN_STATUSES: OrderStatus[] = [
  "received",
  "preparing",
  "ready",
  "delivered",
];
const STATUS_LABEL: Record<string, string> = {
  received: "Nová",
  preparing: "Pripravuje sa",
  ready: "Pripravené",
  delivered: "Vydané",
};

function Kitchen() {
  const [orders, setOrders] = useState(
    [
      { id: "A1B2", items: ["2× Margherita", "1× Coca-Cola"], mins: 2, status: "received", type: "Rozvoz" },
      { id: "C3D4", items: ["1× Diavola L", "Cesnakový chlieb"], mins: 6, status: "preparing", type: "Odber" },
      { id: "E5F6", items: ["1× Pyro Special", "1× Tiramisu"], mins: 11, status: "ready", type: "Rozvoz" },
    ].map((o) => ({ ...o, status: o.status as OrderStatus }))
  );
  const [sound, setSound] = useState(true);

  function advance(id: string) {
    setOrders((os) =>
      os.map((o) => {
        if (o.id !== id) return o;
        const idx = KITCHEN_STATUSES.indexOf(o.status);
        return {
          ...o,
          status: KITCHEN_STATUSES[Math.min(idx + 1, KITCHEN_STATUSES.length - 1)],
        };
      })
    );
  }

  const statusColor: Record<string, string> = {
    received: "border-brand-secondary bg-brand-secondary/10",
    preparing: "border-brand-accent bg-brand-accent/10",
    ready: "border-brand-success bg-brand-success/10",
    delivered: "border-neutral-600 bg-black/[0.06] dark:bg-white/5 opacity-60",
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          {orders.filter((o) => o.status !== "delivered").length} aktívnych
          objednávok
        </p>
        <button
          onClick={() => setSound((v) => !v)}
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-2 text-sm",
            sound ? "bg-brand-success/15 text-brand-success" : "bg-black/[0.06] dark:bg-white/5 text-neutral-500"
          )}
        >
          <Volume2 className="h-4 w-4" /> Zvuk {sound ? "zapnutý" : "vypnutý"}
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {orders.map((o) => (
          <motion.div
            layout
            key={o.id}
            className={cn(
              "rounded-2xl border-2 p-5 transition-all",
              statusColor[o.status]
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-xl font-extrabold text-neutral-900 dark:text-white">
                #{o.id}
              </span>
              <span className="chip bg-black/[0.06] dark:bg-white/10 text-neutral-900 dark:text-white">{o.type}</span>
            </div>
            <p className="mt-1 flex items-center gap-1 text-xs text-neutral-400">
              <Clock className="h-3 w-3" /> pred {o.mins} min
            </p>
            <ul className="my-3 space-y-1 text-sm text-neutral-800 dark:text-neutral-200">
              {o.items.map((it) => (
                <li key={it}>• {it}</li>
              ))}
            </ul>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                {STATUS_LABEL[o.status]}
              </span>
              {o.status !== "delivered" && (
                <button
                  onClick={() => advance(o.id)}
                  className="rounded-full bg-neutral-900 px-4 py-1.5 text-sm font-bold text-white dark:bg-white dark:text-brand-dark"
                >
                  {o.status === "received"
                    ? "Prijať"
                    : o.status === "preparing"
                    ? "Hotové"
                    : "Vydať"}
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ---------------- ORDERS ----------------
function Orders() {
  const rows = [
    { id: "A1B2", customer: "Martina K.", total: 24.8, status: "Nová", type: "Rozvoz" },
    { id: "C3D4", customer: "Peter H.", total: 18.5, status: "Pripravuje sa", type: "Odber" },
    { id: "E5F6", customer: "Lucia B.", total: 31.2, status: "Pripravené", type: "Rozvoz" },
    { id: "G7H8", customer: "Jozef M.", total: 12.9, status: "Doručené", type: "Rozvoz" },
  ];
  return (
    <div className="overflow-x-auto rounded-2xl bg-white dark:bg-[#1a1a1a] ring-1 ring-black/[0.06] dark:ring-white/5">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-black/[0.08] dark:border-white/5 text-neutral-500">
          <tr>
            {["ID", "Zákazník", "Typ", "Suma", "Stav"].map((h) => (
              <th key={h} className="p-4 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-black/[0.08] dark:border-white/5 last:border-0">
              <td className="p-4 font-mono font-bold text-neutral-900 dark:text-white">#{r.id}</td>
              <td className="p-4">{r.customer}</td>
              <td className="p-4 text-neutral-400">{r.type}</td>
              <td className="p-4 font-semibold">{eur(r.total)}</td>
              <td className="p-4">
                <span className="chip bg-brand-primary/15 text-brand-secondary">
                  {r.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- PRODUCTS (editable price/availability) ----------------
function Products({ restaurantId }: { restaurantId: string }) {
  const [items, setItems] = useState<Product[]>(
    PRODUCTS.filter((p) => p.restaurantId === restaurantId)
  );
  // resync when restaurant changes
  if (items[0]?.restaurantId !== restaurantId) {
    setItems(PRODUCTS.filter((p) => p.restaurantId === restaurantId));
  }

  function setPrice(id: string, price: number) {
    setItems((it) =>
      it.map((p) => (p.id === id ? { ...p, basePrice: price } : p))
    );
  }
  function toggle(id: string) {
    setItems((it) =>
      it.map((p) => (p.id === id ? { ...p, available: !p.available } : p))
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl bg-white dark:bg-[#1a1a1a] ring-1 ring-black/[0.06] dark:ring-white/5">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-black/[0.08] dark:border-white/5 text-neutral-500">
          <tr>
            {["Produkt", "Kategória", "Cena (€)", "Dostupné"].map((h) => (
              <th key={h} className="p-4 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id} className="border-b border-black/[0.08] dark:border-white/5 last:border-0">
              <td className="p-4 font-semibold text-neutral-900 dark:text-white">{p.name}</td>
              <td className="p-4 capitalize text-neutral-400">{p.category}</td>
              <td className="p-4">
                <input
                  type="number"
                  step="0.1"
                  value={p.basePrice}
                  onChange={(e) => setPrice(p.id, Number(e.target.value))}
                  className="w-24 rounded-lg border border-black/10 dark:border-white/10 bg-neutral-100 dark:bg-[#222] px-2 py-1 outline-none focus:border-brand-primary"
                />
              </td>
              <td className="p-4">
                <button
                  onClick={() => toggle(p.id)}
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors",
                    p.available ? "bg-brand-success" : "bg-neutral-600"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                      p.available ? "left-[22px]" : "left-0.5"
                    )}
                  />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- RESTAURANTS ----------------
function Restaurants({ restaurantId }: { restaurantId: string }) {
  const r = RESTAURANTS.find((x) => x.id === restaurantId)!;
  const fields = [
    ["Názov", r.name],
    ["Mesto", r.city],
    ["Adresa", r.address],
    ["Telefón", r.phone],
    ["Email", r.email],
    ["Príprava (min)", String(r.prepTimeMinutes)],
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl bg-white dark:bg-[#1a1a1a] p-5 ring-1 ring-black/[0.06] dark:ring-white/5">
        <h3 className="mb-4 font-display font-bold text-neutral-900 dark:text-white">
          Nastavenia prevádzky
        </h3>
        <div className="grid gap-3">
          {fields.map(([label, value]) => (
            <div key={label}>
              <label className="mb-1 block text-xs text-neutral-500">
                {label}
              </label>
              <input
                defaultValue={value}
                className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-neutral-100 dark:bg-[#222] px-3 py-2 outline-none focus:border-brand-primary"
              />
            </div>
          ))}
        </div>
        <button className="btn-primary mt-4">Uložiť zmeny</button>
      </div>
      <div className="rounded-2xl bg-white dark:bg-[#1a1a1a] p-5 ring-1 ring-black/[0.06] dark:ring-white/5">
        <h3 className="mb-4 font-display font-bold text-neutral-900 dark:text-white">
          Nezávislé nastavenia
        </h3>
        <ul className="space-y-2 text-sm text-neutral-300">
          {[
            "Vlastné menu a ceny",
            "Vlastné otváracie hodiny",
            "Vlastné rozvozové zóny",
            "Minimálna objednávka & doprava",
            "Zamestnanci a tlačiareň",
            "Kuchynský displej (KDS)",
          ].map((f) => (
            <li key={f} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-secondary" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------------- DELIVERY ZONES (fully editable) ----------------
function Zones({ restaurantId }: { restaurantId: string }) {
  const base = RESTAURANTS.find((x) => x.id === restaurantId)!.deliveryZones;
  const [zones, setZones] = useState<DeliveryZone[]>(base);
  if (zones[0] && !base.some((b) => b.id === zones[0].id)) {
    setZones(base);
  }
  const [newArea, setNewArea] = useState<Record<string, string>>({});

  function update(id: string, patch: Partial<DeliveryZone>) {
    setZones((zs) => zs.map((z) => (z.id === id ? { ...z, ...patch } : z)));
  }
  function addArea(id: string) {
    const val = (newArea[id] || "").trim();
    if (!val) return;
    setZones((zs) =>
      zs.map((z) => (z.id === id ? { ...z, areas: [...z.areas, val] } : z))
    );
    setNewArea((n) => ({ ...n, [id]: "" }));
  }
  function removeArea(id: string, area: string) {
    setZones((zs) =>
      zs.map((z) =>
        z.id === id ? { ...z, areas: z.areas.filter((a) => a !== area) } : z
      )
    );
  }
  function addZone() {
    setZones((zs) => [
      ...zs,
      {
        id: `zone-${Date.now()}`,
        name: `Zóna ${String.fromCharCode(65 + zs.length)}`,
        minimumOrder: 20,
        deliveryFee: 3,
        estimatedMinutes: 55,
        areas: [],
      },
    ]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          Upravte zóny, minimá, poplatky a zoznam ulíc/obcí. Podpora importu a
          budúcich GPS polygónov.
        </p>
        <button onClick={addZone} className="btn-primary text-sm">
          <Plus className="h-4 w-4" /> Pridať zónu
        </button>
      </div>
      {zones.map((z) => (
        <div key={z.id} className="rounded-2xl bg-white dark:bg-[#1a1a1a] p-5 ring-1 ring-black/[0.06] dark:ring-white/5">
          <div className="grid gap-3 sm:grid-cols-4">
            <LabeledInput
              label="Názov zóny"
              value={z.name}
              onChange={(v) => update(z.id, { name: v })}
            />
            <LabeledNumber
              label="Min. objednávka €"
              value={z.minimumOrder}
              onChange={(v) => update(z.id, { minimumOrder: v })}
            />
            <LabeledNumber
              label="Doprava €"
              value={z.deliveryFee}
              onChange={(v) => update(z.id, { deliveryFee: v })}
            />
            <LabeledNumber
              label="Doručenie min"
              value={z.estimatedMinutes}
              onChange={(v) => update(z.id, { estimatedMinutes: v })}
            />
          </div>
          <div className="mt-4">
            <p className="mb-2 text-xs text-neutral-500">Ulice / obce</p>
            <div className="flex flex-wrap gap-2">
              {z.areas.map((a) => (
                <span
                  key={a}
                  className="flex items-center gap-1 rounded-full bg-black/[0.06] dark:bg-white/5 px-3 py-1 text-sm"
                >
                  {a}
                  <button
                    onClick={() => removeArea(z.id, a)}
                    className="text-neutral-500 hover:text-brand-error"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <div className="flex items-center gap-1">
                <input
                  value={newArea[z.id] || ""}
                  onChange={(e) =>
                    setNewArea((n) => ({ ...n, [z.id]: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && addArea(z.id)}
                  placeholder="+ pridať obec"
                  className="w-32 rounded-full border border-black/10 dark:border-white/10 bg-neutral-100 dark:bg-[#222] px-3 py-1 text-sm outline-none focus:border-brand-primary"
                />
              </div>
            </div>
          </div>
        </div>
      ))}
      <div className="rounded-2xl border border-dashed border-black/10 dark:border-white/10 p-4 text-center text-xs text-neutral-500">
        💡 Zmeny sa v produkcii ukladajú cez Server Actions do PostgreSQL
        (Prisma). Tu je ukážka editovateľného rozhrania.
      </div>
    </div>
  );
}

// ---------------- COUPONS ----------------
function Coupons() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {COUPONS.map((c) => (
        <div key={c.code} className="rounded-2xl bg-white dark:bg-[#1a1a1a] p-5 ring-1 ring-black/[0.06] dark:ring-white/5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-lg font-bold text-brand-secondary">
              {c.code}
            </span>
            <span className="chip bg-brand-success/15 text-brand-success">
              aktívny
            </span>
          </div>
          <p className="mt-2 text-sm text-neutral-300">{c.label}</p>
          <div className="mt-3 flex gap-2 text-xs text-neutral-500">
            <span className="rounded-full bg-black/[0.06] dark:bg-white/5 px-2 py-1 capitalize">
              {c.type.replace("_", " ")}
            </span>
            <span className="rounded-full bg-black/[0.06] dark:bg-white/5 px-2 py-1">
              od {eur(c.minSubtotal)}
            </span>
          </div>
        </div>
      ))}
      <button className="flex min-h-[140px] items-center justify-center rounded-2xl border-2 border-dashed border-black/10 dark:border-white/10 text-neutral-500 hover:border-brand-primary hover:text-brand-secondary">
        <Plus className="mr-2 h-5 w-5" /> Nový kupón
      </button>
    </div>
  );
}

// ---------------- REVIEWS ----------------
function Reviews() {
  return (
    <div className="space-y-4">
      {REVIEWS.map((r) => (
        <div key={r.name} className="rounded-2xl bg-white dark:bg-[#1a1a1a] p-5 ring-1 ring-black/[0.06] dark:ring-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-neutral-900 dark:text-white">{r.name}</span>
              {r.verified && (
                <span className="chip bg-brand-success/15 text-brand-success">
                  overený
                </span>
              )}
            </div>
            <div className="flex text-brand-accent">
              {Array.from({ length: r.rating }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-current" />
              ))}
            </div>
          </div>
          <p className="mt-2 text-sm text-neutral-300">{r.text}</p>
          <button className="mt-3 text-xs font-semibold text-brand-secondary">
            Odpovedať zákazníkovi →
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------------- shared inputs ----------------
function LabeledInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-neutral-500">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-neutral-100 dark:bg-[#222] px-3 py-2 text-sm outline-none focus:border-brand-primary"
      />
    </div>
  );
}
function LabeledNumber({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-neutral-500">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-neutral-100 dark:bg-[#222] px-3 py-2 text-sm outline-none focus:border-brand-primary"
      />
    </div>
  );
}
