"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { RESTAURANTS, PRODUCTS, COUPONS, REVIEWS } from "@/lib/data";
import type { DeliveryZone, Product } from "@/lib/types";
import { eur, cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { BarChart, Sparkline, Heatmap } from "@/components/admin/AdminCharts";
import { logoutAction } from "@/lib/auth-actions";
import {
  getAdminSummary,
  setSoldOut as setSoldOutServer,
  setOrderStatus,
  type AdminSummary,
} from "@/lib/server-actions";
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
  Trash2,
  ArrowLeft,
  Bell,
  Volume2,
  Sun,
  Moon,
  Power,
  Timer,
  LogOut,
  AlertTriangle,
  Check,
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
  { id: "restaurants", label: "Prevádzka", icon: <Store className="h-5 w-5" /> },
  { id: "zones", label: "Rozvozové zóny", icon: <MapPin className="h-5 w-5" /> },
  { id: "coupons", label: "Kupóny", icon: <Ticket className="h-5 w-5" /> },
  { id: "reviews", label: "Recenzie", icon: <Star className="h-5 w-5" /> },
];

export function AdminApp({
  restaurantId,
  adminName,
  adminEmail,
}: {
  restaurantId: string;
  adminName: string;
  adminEmail: string;
}) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const restaurant = RESTAURANTS.find((r) => r.id === restaurantId)!;

  const refresh = useCallback(() => {
    getAdminSummary(restaurantId).then(setSummary).catch(() => {});
  }, [restaurantId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 20000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <div className="flex min-h-screen bg-[#f4f4f5] text-neutral-800 dark:bg-[#0f0f0f] dark:text-neutral-200">
      {/* sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-black/[0.08] bg-white dark:border-white/5 dark:bg-[#161616] md:flex">
        <div className="flex items-center gap-2 border-b border-black/[0.08] p-5 dark:border-white/5">
          <span className="text-2xl">🔥</span>
          <div>
            <p className="font-display font-extrabold text-neutral-900 dark:text-white">
              {restaurant.name}
            </p>
            <p className="text-xs text-neutral-500">Administrácia prevádzky</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 pt-4">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setTab(n.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                tab === n.id
                  ? "bg-brand-primary text-white"
                  : "text-neutral-500 hover:bg-black/5 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-white"
              )}
            >
              {n.icon}
              {n.label}
              {n.id === "kitchen" &&
                summary &&
                summary.pendingCount > 0 && (
                  <span className="ml-auto rounded-full bg-brand-error px-2 py-0.5 text-[11px] font-bold text-white">
                    {summary.pendingCount}
                  </span>
                )}
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
      <div className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-black/10 bg-white p-1 dark:border-white/10 dark:bg-[#161616] md:hidden">
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

      <main className="flex-1 overflow-x-hidden p-5 pb-24 md:p-8 md:pb-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-neutral-900 dark:text-white">
              {NAV.find((n) => n.id === tab)?.label}
            </h1>
            <p className="text-sm text-neutral-500">
              {restaurant.name} · {restaurant.city}
              {summary?.soldOut && (
                <span className="ml-2 rounded-full bg-brand-error/15 px-2 py-0.5 text-xs font-semibold text-brand-error">
                  VYPREDANÉ
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button className="rounded-full bg-black/[0.06] p-2.5 text-neutral-500 dark:bg-white/5 dark:text-neutral-400">
              <Bell className="h-5 w-5" />
            </button>
            <form action={logoutAction}>
              <button
                title={`Odhlásiť ${adminEmail}`}
                className="flex items-center gap-2 rounded-full bg-black/[0.06] px-3 py-2 text-sm font-medium text-neutral-700 dark:bg-white/5 dark:text-neutral-200"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">{adminName}</span>
              </button>
            </form>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {tab === "dashboard" && <Dashboard summary={summary} />}
            {tab === "kitchen" && (
              <Kitchen
                summary={summary}
                restaurantId={restaurantId}
                refresh={refresh}
              />
            )}
            {tab === "orders" && <Orders summary={summary} />}
            {tab === "products" && <Products restaurantId={restaurantId} />}
            {tab === "restaurants" && (
              <Operations
                restaurantId={restaurantId}
                summary={summary}
                refresh={refresh}
              />
            )}
            {tab === "zones" && <Zones restaurantId={restaurantId} />}
            {tab === "coupons" && <Coupons />}
            {tab === "reviews" && <Reviews />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// ---------------- THEME TOGGLE ----------------
function ThemeToggle() {
  const theme = useApp((s) => s.theme);
  const toggleTheme = useApp((s) => s.toggleTheme);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <button
      onClick={toggleTheme}
      aria-label="Prepnúť svetlý/tmavý režim"
      className="rounded-full bg-black/[0.06] p-2.5 text-neutral-500 transition-colors hover:bg-black/10 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10"
    >
      {mounted && theme === "dark" ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  );
}

const CARD = "rounded-2xl bg-white p-5 ring-1 ring-black/[0.06] dark:bg-[#1a1a1a] dark:ring-white/5";

// ---------------- DASHBOARD ----------------
function Dashboard({ summary }: { summary: AdminSummary | null }) {
  const stats = [
    {
      label: "Predané pizze dnes",
      value: summary ? String(summary.soldToday) : "—",
      sub: "reset o 12:00",
      icon: <Pizza />,
      accent: true,
    },
    {
      label: "Objednávky dnes",
      value: summary ? String(summary.ordersToday) : "—",
      sub: "od otváračky",
      icon: <ShoppingBag />,
    },
    {
      label: "Tržby dnes",
      value: summary ? eur(summary.revenueToday) : "—",
      sub: "bez zrušených",
      icon: <Euro />,
    },
    {
      label: "Aktívne objednávky",
      value: summary ? String(summary.pendingCount) : "—",
      sub: `~${summary?.waitMinutes ?? "—"} min čakanie`,
      icon: <Timer />,
    },
  ];
  const week = [
    { label: "Po", value: 0 },
    { label: "Ut", value: 0 },
    { label: "St", value: 0 },
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
          <div
            key={s.label}
            className={cn(
              CARD,
              s.accent && "ring-2 ring-brand-primary/40"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="rounded-xl bg-brand-primary/15 p-2 text-brand-primary">
                {s.icon}
              </span>
              <span className="text-xs font-medium text-neutral-400">
                {s.sub}
              </span>
            </div>
            <p className="mt-3 font-display text-3xl font-extrabold text-neutral-900 dark:text-white">
              {s.value}
            </p>
            <p className="text-sm text-neutral-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className={cn(CARD, "lg:col-span-2")}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display font-bold text-neutral-900 dark:text-white">
              Tržby za týždeň
            </h3>
          </div>
          <BarChart data={week} />
        </div>
        <div className={CARD}>
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
        <div className={CARD}>
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
        <div className={CARD}>
          <h3 className="mb-4 flex items-center gap-2 font-display font-bold text-neutral-900 dark:text-white">
            <Clock className="h-4 w-4" /> Heatmapa objednávok (špičky)
          </h3>
          <Heatmap grid={heat} />
        </div>
      </div>
    </div>
  );
}

// ---------------- KITCHEN DISPLAY (real orders) ----------------
const NEXT_STATUS: Record<string, string> = {
  received: "preparing",
  accepted: "preparing",
  preparing: "ready",
  ready: "delivered",
};
const STATUS_LABEL: Record<string, string> = {
  received: "Nová",
  accepted: "Prijatá",
  preparing: "Pripravuje sa",
  ready: "Pripravené",
  delivered: "Vydané",
};
const STATUS_COLOR: Record<string, string> = {
  received: "border-brand-secondary bg-brand-secondary/10",
  accepted: "border-brand-secondary bg-brand-secondary/10",
  preparing: "border-brand-accent bg-brand-accent/10",
  ready: "border-brand-success bg-brand-success/10",
};
const ACTION_LABEL: Record<string, string> = {
  received: "Prijať do prípravy",
  accepted: "Prijať do prípravy",
  preparing: "Označiť hotové",
  ready: "Vydať / doručiť",
};

function Kitchen({
  summary,
  restaurantId,
  refresh,
}: {
  summary: AdminSummary | null;
  restaurantId: string;
  refresh: () => void;
}) {
  const [sound, setSound] = useState(true);
  const active =
    summary?.orders.filter((o) =>
      ["received", "accepted", "preparing", "ready"].includes(o.status)
    ) ?? [];

  async function advance(id: string, status: string) {
    const next = NEXT_STATUS[status];
    if (!next) return;
    await setOrderStatus(restaurantId, id, next);
    refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          {active.length} aktívnych objednávok · ~
          {summary?.waitMinutes ?? "—"} min čakanie
        </p>
        <button
          onClick={() => setSound((v) => !v)}
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-2 text-sm",
            sound
              ? "bg-brand-success/15 text-brand-success"
              : "bg-black/[0.06] text-neutral-500 dark:bg-white/5"
          )}
        >
          <Volume2 className="h-4 w-4" /> Zvuk {sound ? "zapnutý" : "vypnutý"}
        </button>
      </div>
      {active.length === 0 ? (
        <div className={cn(CARD, "py-16 text-center text-neutral-500")}>
          <ChefHat className="mx-auto mb-3 h-10 w-10 opacity-40" />
          Žiadne aktívne objednávky.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((o) => (
            <motion.div
              layout
              key={o.id}
              className={cn(
                "rounded-2xl border-2 p-5 transition-all",
                STATUS_COLOR[o.status]
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-xl font-extrabold text-neutral-900 dark:text-white">
                  #{o.id}
                </span>
                <span className="chip bg-black/[0.06] text-neutral-900 dark:bg-white/10 dark:text-white">
                  {o.fulfillment === "delivery" ? "Rozvoz" : "Odber"}
                </span>
              </div>
              <p className="mt-1 flex items-center gap-1 text-xs text-neutral-400">
                <Clock className="h-3 w-3" /> pred {o.minsAgo} min ·{" "}
                {o.customerName}
              </p>
              <ul className="my-3 space-y-1 text-sm text-neutral-800 dark:text-neutral-200">
                {o.lines.map((it, i) => (
                  <li key={i}>
                    • {it.quantity}× {it.name}
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                  {STATUS_LABEL[o.status]}
                </span>
                <button
                  onClick={() => advance(o.id, o.status)}
                  className="rounded-full bg-neutral-900 px-4 py-1.5 text-sm font-bold text-white dark:bg-white dark:text-brand-dark"
                >
                  {ACTION_LABEL[o.status]}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- ORDERS (real) ----------------
function Orders({ summary }: { summary: AdminSummary | null }) {
  const rows = summary?.orders ?? [];
  return (
    <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-black/[0.06] dark:bg-[#1a1a1a] dark:ring-white/5">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-black/[0.08] text-neutral-500 dark:border-white/5">
          <tr>
            {["ID", "Zákazník", "Typ", "Suma", "Stav"].map((h) => (
              <th key={h} className="p-4 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="p-8 text-center text-neutral-500">
                Zatiaľ žiadne objednávky.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-b border-black/[0.08] last:border-0 dark:border-white/5"
            >
              <td className="p-4 font-mono font-bold text-neutral-900 dark:text-white">
                #{r.id}
              </td>
              <td className="p-4">{r.customerName}</td>
              <td className="p-4 text-neutral-400">
                {r.fulfillment === "delivery" ? "Rozvoz" : "Odber"}
              </td>
              <td className="p-4 font-semibold">{eur(r.total)}</td>
              <td className="p-4">
                <span className="chip bg-brand-primary/15 text-brand-primary">
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- OPERATIONS (Prevádzka): sold-out + auto kitchen load ----------------
function Operations({
  restaurantId,
  summary,
  refresh,
}: {
  restaurantId: string;
  summary: AdminSummary | null;
  refresh: () => void;
}) {
  const r = RESTAURANTS.find((x) => x.id === restaurantId)!;
  const soldOut = summary?.soldOut ?? false;
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle(next: boolean) {
    setBusy(true);
    await setSoldOutServer(restaurantId, next);
    setConfirming(false);
    setBusy(false);
    refresh();
  }

  const fields = [
    ["Názov", r.name],
    ["Mesto", r.city],
    ["Adresa", r.address],
    ["Telefón", r.phone],
    ["Email", r.email],
    ["Základná príprava (min)", String(r.prepTimeMinutes)],
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* SOLD-OUT card (the only place the button lives) */}
        <div
          className={cn(
            "flex flex-col justify-between gap-4 rounded-2xl border p-5",
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
                  ? "Zákazníci momentálne nemôžu objednávať."
                  : "Označením ako vypredané pozastavíte objednávky na webe."}
              </p>
            </div>
          </div>
          {soldOut ? (
            <button
              onClick={() => toggle(false)}
              disabled={busy}
              className="rounded-full bg-brand-success px-5 py-2.5 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50"
            >
              Znovu spustiť objednávky
            </button>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              disabled={busy}
              className="rounded-full bg-brand-error px-5 py-2.5 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50"
            >
              Označiť ako vypredané
            </button>
          )}
        </div>

        {/* Auto kitchen load (read-only, from pending orders) */}
        <div className={CARD}>
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
                  Automaticky podľa nepripravených objednávok.
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl font-extrabold text-brand-primary">
                ~{summary?.waitMinutes ?? "—"} min
              </p>
              <p className="text-xs text-neutral-500">odhad. čakanie</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4 text-sm text-neutral-500">
            <span className="flex items-center gap-1.5">
              <Pizza className="h-4 w-4 text-brand-primary" />
              {summary?.pendingPizzas ?? 0} pizz v poradí
            </span>
            <span className="flex items-center gap-1.5">
              <ShoppingBag className="h-4 w-4 text-brand-secondary" />
              {summary?.pendingCount ?? 0} objednávok
            </span>
          </div>
        </div>
      </div>

      {/* settings */}
      <div className={CARD}>
        <h3 className="mb-4 font-display font-bold text-neutral-900 dark:text-white">
          Nastavenia prevádzky
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label}>
              <label className="mb-1 block text-xs text-neutral-500">
                {label}
              </label>
              <input
                defaultValue={value}
                className="w-full rounded-lg border border-black/10 bg-neutral-100 px-3 py-2 outline-none focus:border-brand-primary dark:border-white/10 dark:bg-[#222]"
              />
            </div>
          ))}
        </div>
        <button className="btn-primary mt-4">Uložiť zmeny</button>
      </div>

      {/* confirmation modal */}
      <AnimatePresence>
        {confirming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !busy && setConfirming(false)}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl dark:bg-[#1e1e1e]"
            >
              <div className="mx-auto mb-3 inline-flex rounded-2xl bg-brand-error/15 p-3 text-brand-error">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <h3 className="font-display text-xl font-bold text-neutral-900 dark:text-white">
                Naozaj označiť ako vypredané?
              </h3>
              <p className="mt-2 text-sm text-neutral-500">
                Zákazníci nebudú môcť objednávať, kým prevádzku znova nespustíte.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setConfirming(false)}
                  disabled={busy}
                  className="rounded-full border border-black/10 py-2.5 text-sm font-semibold text-neutral-700 dark:border-white/10 dark:text-neutral-200"
                >
                  Zrušiť
                </button>
                <button
                  onClick={() => toggle(true)}
                  disabled={busy}
                  className="flex items-center justify-center gap-2 rounded-full bg-brand-error py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  <Check className="h-4 w-4" /> Áno, vypredané
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------- PRODUCTS (editable price/availability, local) ----------------
function Products({ restaurantId }: { restaurantId: string }) {
  const [items, setItems] = useState<Product[]>(
    PRODUCTS.filter((p) => p.restaurantId === restaurantId)
  );

  function setPrice(id: string, price: number) {
    setItems((it) => it.map((p) => (p.id === id ? { ...p, basePrice: price } : p)));
  }
  function toggle(id: string) {
    setItems((it) =>
      it.map((p) => (p.id === id ? { ...p, available: !p.available } : p))
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-black/[0.06] dark:bg-[#1a1a1a] dark:ring-white/5">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-black/[0.08] text-neutral-500 dark:border-white/5">
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
            <tr
              key={p.id}
              className="border-b border-black/[0.08] last:border-0 dark:border-white/5"
            >
              <td className="p-4 font-semibold text-neutral-900 dark:text-white">
                {p.name}
              </td>
              <td className="p-4 capitalize text-neutral-400">{p.category}</td>
              <td className="p-4">
                <input
                  type="number"
                  step="0.1"
                  value={p.basePrice}
                  onChange={(e) => setPrice(p.id, Number(e.target.value))}
                  className="w-24 rounded-lg border border-black/10 bg-neutral-100 px-2 py-1 outline-none focus:border-brand-primary dark:border-white/10 dark:bg-[#222]"
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

// ---------------- DELIVERY ZONES (editable, local) ----------------
function Zones({ restaurantId }: { restaurantId: string }) {
  const base = RESTAURANTS.find((x) => x.id === restaurantId)!.deliveryZones;
  const [zones, setZones] = useState<DeliveryZone[]>(base);
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
        minimumOrder: 15,
        deliveryFee: 0,
        estimatedMinutes: 50,
        areas: [],
      },
    ]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          Upravte zóny, minimá, poplatky a zoznam ulíc/obcí.
        </p>
        <button onClick={addZone} className="btn-primary text-sm">
          <Plus className="h-4 w-4" /> Pridať zónu
        </button>
      </div>
      {zones.map((z) => (
        <div key={z.id} className={CARD}>
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
                  className="flex items-center gap-1 rounded-full bg-black/[0.06] px-3 py-1 text-sm dark:bg-white/5"
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
              <input
                value={newArea[z.id] || ""}
                onChange={(e) =>
                  setNewArea((n) => ({ ...n, [z.id]: e.target.value }))
                }
                onKeyDown={(e) => e.key === "Enter" && addArea(z.id)}
                placeholder="+ pridať obec"
                className="w-32 rounded-full border border-black/10 bg-neutral-100 px-3 py-1 text-sm outline-none focus:border-brand-primary dark:border-white/10 dark:bg-[#222]"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------- COUPONS ----------------
function Coupons() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {COUPONS.map((c) => (
        <div key={c.code} className={CARD}>
          <div className="flex items-center justify-between">
            <span className="font-mono text-lg font-bold text-brand-secondary">
              {c.code}
            </span>
            <span className="chip bg-brand-success/15 text-brand-success">
              aktívny
            </span>
          </div>
          <p className="mt-2 text-sm text-neutral-500">{c.label}</p>
          <div className="mt-3 flex gap-2 text-xs text-neutral-500">
            <span className="rounded-full bg-black/[0.06] px-2 py-1 capitalize dark:bg-white/5">
              {c.type.replace("_", " ")}
            </span>
            <span className="rounded-full bg-black/[0.06] px-2 py-1 dark:bg-white/5">
              od {eur(c.minSubtotal)}
            </span>
          </div>
        </div>
      ))}
      <button className="flex min-h-[140px] items-center justify-center rounded-2xl border-2 border-dashed border-black/10 text-neutral-500 hover:border-brand-primary hover:text-brand-secondary dark:border-white/10">
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
        <div key={r.name} className={CARD}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-neutral-900 dark:text-white">
                {r.name}
              </span>
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
          <p className="mt-2 text-sm text-neutral-500">{r.text}</p>
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
        className="w-full rounded-lg border border-black/10 bg-neutral-100 px-3 py-2 text-sm outline-none focus:border-brand-primary dark:border-white/10 dark:bg-[#222]"
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
        className="w-full rounded-lg border border-black/10 bg-neutral-100 px-3 py-2 text-sm outline-none focus:border-brand-primary dark:border-white/10 dark:bg-[#222]"
      />
    </div>
  );
}
