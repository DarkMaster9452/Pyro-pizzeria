"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { RESTAURANTS, CATEGORIES, ALLERGENS } from "@/lib/data";
import type { DeliveryZone, Product, Coupon, CategoryId, Badge } from "@/lib/types";
import { eur, cn, formatAddress } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { BarChart } from "@/components/admin/AdminCharts";
import { logoutAction } from "@/lib/auth-actions";
import { StaffOrderForm } from "@/components/StaffOrderForm";
import {
  getAdminSummary,
  getOrderDetail,
  setSoldOut as setSoldOutServer,
  setOrderStatus,
  adminGetProducts,
  saveProduct,
  setProductAvailable,
  deleteProduct,
  adminGetCoupons,
  createCoupon,
  deleteCoupon,
  adminGetZones,
  saveZones,
  type AdminSummary,
  type OrderDetail,
} from "@/lib/server-actions";
import {
  LayoutDashboard,
  ShoppingBag,
  Pizza,
  Truck,
  Store,
  MapPin,
  Ticket,
  Star,
  ChefHat,
  Euro,
  Clock,
  Plus,
  Trash2,
  ArrowLeft,
  PhoneCall,
  Home,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Power,
  Timer,
  LogOut,
  AlertTriangle,
  Check,
  X,
  Pencil,
} from "lucide-react";

type Tab =
  | "dashboard"
  | "kitchen"
  | "neworder"
  | "orders"
  | "products"
  | "restaurants"
  | "zones"
  | "coupons"
  | "reviews";

const NAV: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Prehľad", icon: <LayoutDashboard className="h-5 w-5" /> },
  { id: "kitchen", label: "Kuchyňa (KDS)", icon: <ChefHat className="h-5 w-5" /> },
  { id: "neworder", label: "Nová objednávka", icon: <PhoneCall className="h-5 w-5" /> },
  { id: "orders", label: "Objednávky", icon: <ShoppingBag className="h-5 w-5" /> },
  { id: "products", label: "Produkty", icon: <Pizza className="h-5 w-5" /> },
  { id: "restaurants", label: "Prevádzka", icon: <Store className="h-5 w-5" /> },
  { id: "zones", label: "Rozvozové zóny", icon: <MapPin className="h-5 w-5" /> },
  { id: "coupons", label: "Kupóny", icon: <Ticket className="h-5 w-5" /> },
  { id: "reviews", label: "Recenzie", icon: <Star className="h-5 w-5" /> },
];

// ------------ new-order sound (Web Audio, no asset) ------------
let audioCtx: AudioContext | null = null;
function beep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    audioCtx ??= new Ctx();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const now = audioCtx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const o = audioCtx!.createOscillator();
      const g = audioCtx!.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      const t = now + i * 0.18;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g);
      g.connect(audioCtx!.destination);
      o.start(t);
      o.stop(t + 0.24);
    });
  } catch {
    /* audio not available */
  }
}

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
  const [sound, setSound] = useState(true);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const restaurant = RESTAURANTS.find((r) => r.id === restaurantId)!;
  const seenIds = useRef<Set<string> | null>(null);

  const refresh = useCallback(() => {
    getAdminSummary(restaurantId).then(setSummary).catch(() => {});
  }, [restaurantId]);

  // Auto-refresh every 5 seconds.
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  // Resume the audio context on the first interaction (browser autoplay rules).
  useEffect(() => {
    const resume = () => {
      if (audioCtx?.state === "suspended") void audioCtx.resume();
    };
    window.addEventListener("pointerdown", resume);
    return () => window.removeEventListener("pointerdown", resume);
  }, []);

  // Ring when a brand-new order arrives while the admin is open.
  useEffect(() => {
    if (!summary) return;
    const ids = summary.orders.map((o) => o.id);
    if (seenIds.current === null) {
      seenIds.current = new Set(ids);
      return;
    }
    const fresh = summary.orders.filter(
      (o) => !seenIds.current!.has(o.id) && o.status === "received"
    );
    if (fresh.length && sound) beep();
    seenIds.current = new Set(ids);
  }, [summary, sound]);

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
              {n.id === "kitchen" && summary && summary.pendingCount > 0 && (
                <span className="ml-auto rounded-full bg-brand-error px-2 py-0.5 text-[11px] font-bold text-white">
                  {summary.pendingCount}
                </span>
              )}
            </button>
          ))}
        </nav>
        <Link
          href="/rozvoz"
          className="mx-3 mt-3 flex items-center gap-2 rounded-xl bg-brand-primary/10 px-3 py-2.5 text-sm font-semibold text-brand-primary hover:bg-brand-primary/15"
        >
          <Truck className="h-4 w-4" /> Výdaj / Rozvoz
        </Link>
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
            <Link
              href="/"
              title="Späť na web (bez odhlásenia)"
              className="flex items-center gap-2 rounded-full bg-black/[0.06] px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-black/10 dark:bg-white/5 dark:text-neutral-200 dark:hover:bg-white/10"
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Späť na web</span>
            </Link>
            <ThemeToggle />
            <button
              onClick={() => setSound((v) => !v)}
              title={sound ? "Zvuk zapnutý" : "Zvuk vypnutý"}
              className={cn(
                "rounded-full p-2.5 transition-colors",
                sound
                  ? "bg-brand-success/15 text-brand-success"
                  : "bg-black/[0.06] text-neutral-500 dark:bg-white/5 dark:text-neutral-400"
              )}
            >
              {sound ? (
                <Volume2 className="h-5 w-5" />
              ) : (
                <VolumeX className="h-5 w-5" />
              )}
            </button>
            <button
              onClick={() => setConfirmLogout(true)}
              title={`Odhlásiť ${adminEmail}`}
              className="flex items-center gap-2 rounded-full bg-black/[0.06] px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-black/10 dark:bg-white/5 dark:text-neutral-200 dark:hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{adminName}</span>
            </button>
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
                onOpen={setOpenOrderId}
              />
            )}
            {tab === "neworder" && (
              <div className={cn(CARD)}>
                <p className="mb-4 text-sm text-neutral-500">
                  Telefonická objednávka — zadajte položky a údaje zákazníka.
                  Objednávka pôjde rovno do kuchyne.
                </p>
                <StaffOrderForm
                  restaurantId={restaurantId}
                  onCreated={refresh}
                />
              </div>
            )}
            {tab === "orders" && (
              <Orders summary={summary} onOpen={setOpenOrderId} />
            )}
            {tab === "products" && <Products restaurantId={restaurantId} />}
            {tab === "restaurants" && (
              <Operations
                restaurantId={restaurantId}
                summary={summary}
                refresh={refresh}
              />
            )}
            {tab === "zones" && <Zones restaurantId={restaurantId} />}
            {tab === "coupons" && <Coupons restaurantId={restaurantId} />}
            {tab === "reviews" && <Reviews />}
          </motion.div>
        </AnimatePresence>
      </main>

      {openOrderId && (
        <OrderDetailModal
          restaurantId={restaurantId}
          id={openOrderId}
          onClose={() => setOpenOrderId(null)}
        />
      )}

      <AnimatePresence>
        {confirmLogout && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirmLogout(false)}
            className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl bg-white p-6 dark:bg-[#1b1b1b]"
            >
              <h3 className="font-display text-lg font-extrabold text-neutral-900 dark:text-white">
                Odhlásiť sa?
              </h3>
              <p className="mt-1 text-sm text-neutral-500">
                Budete sa musieť znova prihlásiť. Ak sa chcete len pozrieť na
                web, použite „Späť na web“ — zostanete prihlásený.
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => setConfirmLogout(false)}
                  className="flex-1 rounded-full border border-black/10 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-black/5 dark:border-white/15 dark:text-neutral-200 dark:hover:bg-white/5"
                >
                  Zrušiť
                </button>
                <form action={logoutAction} className="flex-1">
                  <button className="w-full rounded-full bg-brand-error py-2.5 text-sm font-bold text-white hover:brightness-110">
                    Odhlásiť
                  </button>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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

// ---------------- DASHBOARD (real stats) ----------------
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
  const week = summary?.week ?? [];
  const top = summary?.topProducts ?? [];
  const topMax = Math.max(1, ...top.map((t) => t.value));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className={cn(CARD, s.accent && "ring-2 ring-brand-primary/40")}
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
          <h3 className="mb-4 font-display font-bold text-neutral-900 dark:text-white">
            Tržby za posledných 7 dní
          </h3>
          {week.some((w) => w.value > 0) ? (
            <BarChart data={week} />
          ) : (
            <p className="py-10 text-center text-sm text-neutral-500">
              Zatiaľ žiadne tržby za posledný týždeň.
            </p>
          )}
        </div>
        <div className={CARD}>
          <h3 className="mb-4 font-display font-bold text-neutral-900 dark:text-white">
            Najpredávanejšie
          </h3>
          {top.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-500">
              Zatiaľ žiadne predaje.
            </p>
          ) : (
            <div className="space-y-3">
              {top.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="w-5 text-sm font-bold text-neutral-500">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-sm">{p.name}</span>
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-brand-primary to-brand-secondary"
                      style={{ width: `${(p.value / topMax) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm text-neutral-400">
                    {p.value}
                  </span>
                </div>
              ))}
            </div>
          )}
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
  delivering: "Doručuje sa",
  delivered: "Vydané",
  cancelled: "Zrušená",
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
  onOpen,
}: {
  summary: AdminSummary | null;
  restaurantId: string;
  refresh: () => void;
  onOpen: (id: string) => void;
}) {
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
          {summary?.waitMinutes ?? "—"} min čakanie · aktualizuje sa každých 5 s
        </p>
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
                <button
                  onClick={() => onOpen(o.id)}
                  className="font-display text-xl font-extrabold text-neutral-900 underline-offset-2 hover:underline dark:text-white"
                >
                  #{o.id}
                </button>
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

// ---------------- ORDERS (real, clickable) ----------------
function Orders({
  summary,
  onOpen,
}: {
  summary: AdminSummary | null;
  onOpen: (id: string) => void;
}) {
  const rows = summary?.orders ?? [];
  return (
    <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-black/[0.06] dark:bg-[#1a1a1a] dark:ring-white/5">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-black/[0.08] text-neutral-500 dark:border-white/5">
          <tr>
            {["ID", "Zákazník", "Typ", "Suma", "Stav", ""].map((h) => (
              <th key={h} className="p-4 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="p-8 text-center text-neutral-500">
                Zatiaľ žiadne objednávky.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={() => onOpen(r.id)}
              className="cursor-pointer border-b border-black/[0.08] last:border-0 hover:bg-black/[0.03] dark:border-white/5 dark:hover:bg-white/5"
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
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="chip bg-brand-primary/15 text-brand-primary">
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                  {r.paid && (
                    <span className="chip bg-brand-success/15 text-brand-success">
                      Zaplatené
                    </span>
                  )}
                </div>
              </td>
              <td className="p-4 text-right text-xs font-semibold text-brand-secondary">
                Detail →
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- ORDER DETAIL MODAL ----------------
function OrderDetailModal({
  restaurantId,
  id,
  onClose,
}: {
  restaurantId: string;
  id: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getOrderDetail(restaurantId, id)
      .then((d) => active && setDetail(d))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [restaurantId, id]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 dark:bg-[#1b1b1b] sm:rounded-3xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-extrabold text-neutral-900 dark:text-white">
            Objednávka #{id}
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-neutral-400 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <p className="py-12 text-center text-sm text-neutral-500">
            Načítavam…
          </p>
        ) : !detail ? (
          <p className="py-12 text-center text-sm text-neutral-500">
            Objednávka sa nenašla.
          </p>
        ) : (
          <div className="mt-4 space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <span className="chip bg-brand-primary/15 text-brand-primary">
                {STATUS_LABEL[detail.status] ?? detail.status}
              </span>
              <span className="chip bg-black/[0.06] dark:bg-white/10">
                {detail.fulfillment === "delivery" ? "Rozvoz" : "Osobný odber"}
              </span>
              <span className="chip bg-black/[0.06] dark:bg-white/10">
                {detail.payment}
              </span>
              <span className="chip bg-black/[0.06] dark:bg-white/10">
                ETA ~{detail.eta} min
              </span>
            </div>

            <div className="grid gap-3 rounded-2xl bg-black/[0.03] p-4 dark:bg-white/5 sm:grid-cols-2">
              <Info label="Zákazník" value={detail.customerName} />
              <Info label="Telefón" value={detail.phone} />
              {detail.email && <Info label="Email" value={detail.email} />}
              <Info
                label="Prijaté"
                value={new Date(detail.createdAt).toLocaleString("sk-SK")}
              />
              {detail.fulfillment === "delivery" && detail.address && (
                <Info
                  label="Adresa"
                  value={formatAddress(detail.address)}
                  wide
                />
              )}
              {detail.zoneName && (
                <Info label="Zóna" value={detail.zoneName} />
              )}
              {detail.note && <Info label="Poznámka" value={detail.note} wide />}
            </div>

            <div>
              <p className="mb-2 font-semibold text-neutral-900 dark:text-white">
                Položky
              </p>
              <ul className="space-y-2">
                {detail.lines.map((l, i) => (
                  <li
                    key={i}
                    className="rounded-xl border border-black/[0.06] p-3 dark:border-white/10"
                  >
                    <div className="flex justify-between font-medium">
                      <span>
                        {l.quantity}× {l.name}
                        <span className="text-neutral-400"> ({l.sizeLabel})</span>
                      </span>
                      <span>{eur(l.unitPrice * l.quantity)}</span>
                    </div>
                    {(l.extraCheese ||
                      l.stuffedCrust ||
                      l.addedIngredients.length > 0 ||
                      l.removedIngredients.length > 0) && (
                      <p className="mt-1 text-xs text-neutral-500">
                        {l.extraCheese && "+ extra syr "}
                        {l.stuffedCrust && "+ plnený okraj "}
                        {l.addedIngredients.length > 0 &&
                          `+ ${l.addedIngredients.join(", ")} `}
                        {l.removedIngredients.length > 0 &&
                          `− ${l.removedIngredients.join(", ")}`}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-1 border-t border-dashed border-black/10 pt-3 dark:border-white/10">
              <Row label="Medzisúčet" value={eur(detail.subtotal)} />
              <Row label="Doprava" value={eur(detail.deliveryFee)} />
              {detail.discount > 0 && (
                <Row label="Zľava" value={`−${eur(detail.discount)}`} />
              )}
              <div className="flex justify-between pt-1 font-display text-lg font-extrabold text-neutral-900 dark:text-white">
                <span>Spolu</span>
                <span className="text-brand-primary">{eur(detail.total)}</span>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function Info({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <p className="text-xs text-neutral-400">{label}</p>
      <p className="font-medium text-neutral-900 dark:text-white">{value}</p>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-neutral-500">
      <span>{label}</span>
      <span>{value}</span>
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
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
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

      <div className={CARD}>
        <h3 className="mb-4 font-display font-bold text-neutral-900 dark:text-white">
          Údaje prevádzky
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label}>
              <label className="mb-1 block text-xs text-neutral-500">
                {label}
              </label>
              <input
                defaultValue={value}
                readOnly
                className="w-full rounded-lg border border-black/10 bg-neutral-100 px-3 py-2 text-neutral-600 outline-none dark:border-white/10 dark:bg-[#222] dark:text-neutral-300"
              />
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-neutral-400">
          Kontaktné údaje sú súčasťou webu — na zmenu ma kontaktujte.
        </p>
      </div>

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

// ---------------- PRODUCTS (DB-backed CRUD) ----------------
const BADGE_OPTIONS: { id: Badge; label: string }[] = [
  { id: "bestseller", label: "Populárne" },
  { id: "recommended", label: "Odporúčame" },
  { id: "new", label: "Novinka" },
  { id: "spicy", label: "Pikantné" },
  { id: "vegetarian", label: "Vegetariánske" },
];

function Products({ restaurantId }: { restaurantId: string }) {
  const [items, setItems] = useState<Product[] | null>(null);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    adminGetProducts(restaurantId).then(setItems).catch(() => setItems([]));
  }, [restaurantId]);
  useEffect(() => load(), [load]);

  async function toggle(p: Product) {
    setBusyId(p.id);
    setItems((it) =>
      it ? it.map((x) => (x.id === p.id ? { ...x, available: !x.available } : x)) : it
    );
    await setProductAvailable(restaurantId, p.id, !p.available);
    setBusyId(null);
  }
  async function remove(p: Product) {
    if (!confirm(`Zmazať produkt „${p.name}“?`)) return;
    setBusyId(p.id);
    await deleteProduct(restaurantId, p.id);
    load();
  }

  if (!items)
    return <p className="text-sm text-neutral-500">Načítavam produkty…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          {items.length} produktov · zmeny sa ukladajú do databázy a hneď sa
          prejavia na webe.
        </p>
        <button onClick={() => setEditing("new")} className="btn-primary text-sm">
          <Plus className="h-4 w-4" /> Nový produkt
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-black/[0.06] dark:bg-[#1a1a1a] dark:ring-white/5">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/[0.08] text-neutral-500 dark:border-white/5">
            <tr>
              {["Produkt", "Kategória", "Cena", "Dostupné", ""].map((h) => (
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
                  {!p.available && (
                    <span className="ml-2 rounded-full bg-brand-error/15 px-2 py-0.5 text-[11px] font-semibold text-brand-error">
                      aktuálne nedostupná
                    </span>
                  )}
                </td>
                <td className="p-4 capitalize text-neutral-400">
                  {CATEGORIES.find((c) => c.id === p.category)?.name ??
                    p.category}
                </td>
                <td className="p-4 font-semibold">{eur(p.basePrice)}</td>
                <td className="p-4">
                  <button
                    disabled={busyId === p.id}
                    onClick={() => toggle(p)}
                    className={cn(
                      "relative h-6 w-11 rounded-full transition-colors",
                      p.available ? "bg-brand-success" : "bg-neutral-500"
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
                <td className="p-4">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => setEditing(p)}
                      className="rounded-lg p-2 text-neutral-500 hover:bg-black/5 hover:text-brand-primary dark:hover:bg-white/10"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(p)}
                      className="rounded-lg p-2 text-neutral-500 hover:bg-black/5 hover:text-brand-error dark:hover:bg-white/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <ProductEditor
          restaurantId={restaurantId}
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ProductEditor({
  restaurantId,
  product,
  onClose,
  onSaved,
}: {
  restaurantId: string;
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: product?.name ?? "",
    category: (product?.category ?? "pizza") as CategoryId,
    description: product?.description ?? "",
    basePrice: product?.basePrice ?? 0,
    weight: product?.sizes[0]?.label ?? "",
    image: product?.image ?? "",
    ingredients: (product?.ingredients ?? []).join(", "),
    allergens: (product?.allergens ?? []).join(", "),
    badges: product?.badges ?? [],
    available: product?.available ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function toggleBadge(b: Badge) {
    setForm((f) => ({
      ...f,
      badges: f.badges.includes(b)
        ? f.badges.filter((x) => x !== b)
        : [...f.badges, b],
    }));
  }

  async function submit() {
    setSaving(true);
    setError("");
    const res = await saveProduct(restaurantId, {
      id: product?.id,
      category: form.category,
      name: form.name,
      description: form.description,
      image: form.image,
      basePrice: Number(form.basePrice),
      weight: form.weight,
      ingredients: form.ingredients
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      allergens: form.allergens
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      badges: form.badges,
      available: form.available,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "Nepodarilo sa uložiť.");
      return;
    }
    onSaved();
  }

  return (
    <Modal
      title={product ? `Upraviť: ${product.name}` : "Nový produkt"}
      onClose={onClose}
    >
      <div className="space-y-3">
        <TextInput label="Názov" value={form.name} onChange={(v) => set("name", v)} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Kategória</FieldLabel>
            <select
              value={form.category}
              onChange={(e) => set("category", e.target.value as CategoryId)}
              className="w-full rounded-lg border border-black/10 bg-neutral-100 px-3 py-2 text-sm outline-none focus:border-brand-primary dark:border-white/10 dark:bg-[#222]"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <NumInput
            label="Cena (€)"
            value={form.basePrice}
            onChange={(v) => set("basePrice", v)}
          />
        </div>
        <TextInput
          label="Gramáž / veľkosť (napr. 720g)"
          value={form.weight}
          onChange={(v) => set("weight", v)}
        />
        <div>
          <FieldLabel>Popis / zloženie</FieldLabel>
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border border-black/10 bg-neutral-100 px-3 py-2 text-sm outline-none focus:border-brand-primary dark:border-white/10 dark:bg-[#222]"
          />
        </div>
        <TextInput
          label="Suroviny (oddelené čiarkou)"
          value={form.ingredients}
          onChange={(v) => set("ingredients", v)}
        />
        <TextInput
          label="Alergény (čísla oddelené čiarkou)"
          value={form.allergens}
          onChange={(v) => set("allergens", v)}
          hint={ALLERGENS.map((a) => `${a.code}=${a.name}`).join(" · ")}
        />
        <TextInput
          label="Obrázok (URL)"
          value={form.image}
          onChange={(v) => set("image", v)}
        />
        <div>
          <FieldLabel>Štítky</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {BADGE_OPTIONS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => toggleBadge(b.id)}
                className={cn(
                  "chip border transition-colors",
                  form.badges.includes(b.id)
                    ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                    : "border-black/10 text-neutral-500 dark:border-white/10"
                )}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.available}
            onChange={(e) => set("available", e.target.checked)}
            className="h-4 w-4 accent-brand-primary"
          />
          Dostupné (odškrtnite pre „aktuálne nedostupná“)
        </label>

        {error && <p className="text-sm text-brand-error">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold dark:border-white/10"
          >
            Zrušiť
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {saving ? "Ukladám…" : "Uložiť"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------- DELIVERY ZONES (DB-backed) ----------------
function Zones({ restaurantId }: { restaurantId: string }) {
  const [zones, setZones] = useState<DeliveryZone[] | null>(null);
  const [newArea, setNewArea] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    adminGetZones(restaurantId).then(setZones).catch(() => setZones([]));
  }, [restaurantId]);
  useEffect(() => load(), [load]);

  function update(id: string, patch: Partial<DeliveryZone>) {
    setZones((zs) => (zs ? zs.map((z) => (z.id === id ? { ...z, ...patch } : z)) : zs));
    setSaved(false);
  }
  function addArea(id: string) {
    const val = (newArea[id] || "").trim();
    if (!val) return;
    update(id, {
      areas: [...(zones?.find((z) => z.id === id)?.areas ?? []), val],
    });
    setNewArea((n) => ({ ...n, [id]: "" }));
  }
  function removeArea(id: string, area: string) {
    const z = zones?.find((x) => x.id === id);
    if (z) update(id, { areas: z.areas.filter((a) => a !== area) });
  }
  function addZone() {
    setZones((zs) => [
      ...(zs ?? []),
      {
        id: `zone-${Date.now()}`,
        name: `Zóna ${String.fromCharCode(65 + (zs?.length ?? 0))}`,
        minimumOrder: 0,
        deliveryFee: 0,
        estimatedMinutes: 45,
        areas: [],
      },
    ]);
    setSaved(false);
  }
  function removeZone(id: string) {
    setZones((zs) => (zs ? zs.filter((z) => z.id !== id) : zs));
    setSaved(false);
  }
  async function persist() {
    if (!zones) return;
    setSaving(true);
    await saveZones(restaurantId, zones);
    setSaving(false);
    setSaved(true);
  }

  if (!zones) return <p className="text-sm text-neutral-500">Načítavam zóny…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          Upravte zóny, poplatky a zoznam ulíc/obcí. Nezabudnite uložiť.
        </p>
        <div className="flex gap-2">
          <button onClick={addZone} className="btn-ghost text-sm">
            <Plus className="h-4 w-4" /> Pridať zónu
          </button>
          <button
            onClick={persist}
            disabled={saving}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {saving ? "Ukladám…" : saved ? "Uložené ✓" : "Uložiť zmeny"}
          </button>
        </div>
      </div>
      {zones.map((z) => (
        <div key={z.id} className={CARD}>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Zóna
            </span>
            <button
              onClick={() => removeZone(z.id)}
              className="flex items-center gap-1 text-xs font-semibold text-neutral-400 hover:text-brand-error"
            >
              <Trash2 className="h-3.5 w-3.5" /> Zmazať zónu
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <LabeledInput
              label="Názov zóny"
              value={z.name}
              onChange={(v) => update(z.id, { name: v })}
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

// ---------------- COUPONS (DB-backed CRUD) ----------------
function Coupons({ restaurantId }: { restaurantId: string }) {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    adminGetCoupons(restaurantId).then(setCoupons).catch(() => setCoupons([]));
  }, [restaurantId]);
  useEffect(() => load(), [load]);

  async function remove(code: string) {
    if (!confirm(`Zmazať kupón ${code}?`)) return;
    await deleteCoupon(restaurantId, code);
    load();
  }

  if (!coupons)
    return <p className="text-sm text-neutral-500">Načítavam kupóny…</p>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {coupons.map((c) => (
        <div key={c.code} className={CARD}>
          <div className="flex items-center justify-between">
            <span className="font-mono text-lg font-bold text-brand-secondary">
              {c.code}
            </span>
            <button
              onClick={() => remove(c.code)}
              className="rounded-lg p-1.5 text-neutral-400 hover:bg-black/5 hover:text-brand-error dark:hover:bg-white/10"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-sm text-neutral-500">{c.label}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-500">
            <span className="rounded-full bg-black/[0.06] px-2 py-1 capitalize dark:bg-white/5">
              {c.type === "percentage"
                ? `-${c.value}%`
                : c.type === "fixed"
                ? `-${eur(c.value)}`
                : "Doprava zdarma"}
            </span>
            <span className="rounded-full bg-black/[0.06] px-2 py-1 dark:bg-white/5">
              od {eur(c.minSubtotal)}
            </span>
            <span className="rounded-full bg-black/[0.06] px-2 py-1 dark:bg-white/5">
              {c.restaurantId === "all" ? "všetky prevádzky" : "táto prevádzka"}
            </span>
          </div>
        </div>
      ))}
      <button
        onClick={() => setCreating(true)}
        className="flex min-h-[140px] items-center justify-center rounded-2xl border-2 border-dashed border-black/10 text-neutral-500 hover:border-brand-primary hover:text-brand-secondary dark:border-white/10"
      >
        <Plus className="mr-2 h-5 w-5" /> Nový kupón
      </button>

      {creating && (
        <CouponCreator
          restaurantId={restaurantId}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function CouponCreator({
  restaurantId,
  onClose,
  onSaved,
}: {
  restaurantId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    code: "",
    type: "percentage" as "percentage" | "fixed" | "free_delivery",
    value: 10,
    minSubtotal: 0,
    label: "",
    forAll: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setSaving(true);
    setError("");
    const res = await createCoupon(restaurantId, form);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "Nepodarilo sa vytvoriť.");
      return;
    }
    onSaved();
  }

  return (
    <Modal title="Nový kupón" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <FieldLabel>Kód</FieldLabel>
          <input
            value={form.code}
            onChange={(e) =>
              setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
            }
            placeholder="napr. LETO2026"
            name="pyro-new-coupon"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="w-full rounded-lg border border-black/10 bg-neutral-100 px-3 py-2 text-sm uppercase outline-none focus:border-brand-primary dark:border-white/10 dark:bg-[#222]"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Typ</FieldLabel>
            <select
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  type: e.target.value as typeof form.type,
                }))
              }
              className="w-full rounded-lg border border-black/10 bg-neutral-100 px-3 py-2 text-sm outline-none focus:border-brand-primary dark:border-white/10 dark:bg-[#222]"
            >
              <option value="percentage">Percentuálna zľava</option>
              <option value="fixed">Pevná zľava (€)</option>
              <option value="free_delivery">Doprava zdarma</option>
            </select>
          </div>
          {form.type !== "free_delivery" && (
            <NumInput
              label={form.type === "percentage" ? "Zľava (%)" : "Zľava (€)"}
              value={form.value}
              onChange={(v) => setForm((f) => ({ ...f, value: v }))}
            />
          )}
        </div>
        <NumInput
          label="Platí od sumy (€)"
          value={form.minSubtotal}
          onChange={(v) => setForm((f) => ({ ...f, minSubtotal: v }))}
        />
        <TextInput
          label="Popis (pre zákazníka)"
          value={form.label}
          onChange={(v) => setForm((f) => ({ ...f, label: v }))}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.forAll}
            onChange={(e) =>
              setForm((f) => ({ ...f, forAll: e.target.checked }))
            }
            className="h-4 w-4 accent-brand-primary"
          />
          Platí pre obe prevádzky
        </label>
        {error && <p className="text-sm text-brand-error">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold dark:border-white/10"
          >
            Zrušiť
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {saving ? "Vytváram…" : "Vytvoriť kupón"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------- REVIEWS (read-only) ----------------
function Reviews() {
  return (
    <div className={cn(CARD, "text-center")}>
      <Star className="mx-auto mb-3 h-10 w-10 text-brand-accent opacity-60" />
      <h3 className="font-display text-lg font-bold text-neutral-900 dark:text-white">
        Recenzie
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
        Recenzie zbierame automaticky e-mailom po objednávke. Na recenzie sa
        neodpovedá — slúžia len ako spätná väzba pre prevádzku.
      </p>
    </div>
  );
}

// ---------------- shared UI ----------------
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[95] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 dark:bg-[#1b1b1b] sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-extrabold text-neutral-900 dark:text-white">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-neutral-400 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-xs font-semibold text-neutral-500">
      {children}
    </label>
  );
}

function TextInput({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-black/10 bg-neutral-100 px-3 py-2 text-sm outline-none focus:border-brand-primary dark:border-white/10 dark:bg-[#222]"
      />
      {hint && <p className="mt-1 text-[11px] text-neutral-400">{hint}</p>}
    </div>
  );
}

function NumInput({
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
      <FieldLabel>{label}</FieldLabel>
      <input
        type="number"
        step="0.1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-black/10 bg-neutral-100 px-3 py-2 text-sm outline-none focus:border-brand-primary dark:border-white/10 dark:bg-[#222]"
      />
    </div>
  );
}

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
