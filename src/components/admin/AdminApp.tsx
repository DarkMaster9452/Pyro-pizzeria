"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { RESTAURANTS, CATEGORIES, ALLERGENS } from "@/lib/data";
import type { DeliveryZone, Product, CategoryId, Badge } from "@/lib/types";
import { eur, cn, formatAddress, POL_POL_SURCHARGE } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { BarChart } from "@/components/admin/AdminCharts";
import { logoutAction } from "@/lib/auth-actions";
import { StaffOrderForm } from "@/components/StaffOrderForm";
import {
  StaffPasswordBanner,
  OperatorContact,
  StaffPasswordPanel,
} from "@/components/StaffSecurity";
import {
  getAdminSummary,
  getOrderDetail,
  setSoldOut as setSoldOutServer,
  adminGetProducts,
  saveProduct,
  setProductAvailable,
  deleteProduct,
  adminGetCoupons,
  saveCoupons,
  adminGetZones,
  saveZones,
  getHandoverBoard,
  markDispatchPaid,
  getShiftDrivers,
  type ShiftDriver,
  advanceKitchenOrder,
  returnKitchenOrder,
  getServiceStatus,
  getOpenPrep,
  openRestaurant,
  closeRestaurant,
  resetOldOrders,
  getShiftsReport,
  getTipData,
  saveTips,
  getShiftDayDetail,
  getOrderDays,
  getAdminOrdersByDay,
  setOrderSurcharge,
  type TipData,
  type TipAllocation,
  type ShiftDayDetail,
  type AdminSummary,
  type AdminOrderRow,
  type OrderDetail,
  type CouponInput,
  type DispatchOrder,
  type ServiceStatus,
  type OpenPrep,
  type ShiftDay,
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
  CheckCheck,
  X,
  Pencil,
  Phone,
  RefreshCw,
  PackageCheck,
  DoorOpen,
  Users,
  CalendarDays,
  StickyNote,
  Coins,
  ChevronDown,
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

// ------------ new-order sound (bell WAV, amplified LOUD) ------------
let audioCtx: AudioContext | null = null;
let orderBuffer: AudioBuffer | null = null;
let bufferLoading: Promise<AudioBuffer | null> | null = null;
// Extra gain so the bell is loud enough to hear across the kitchen (>1 amplifies
// beyond the file's own level).
const ORDER_SOUND_GAIN = 5;

function getCtx(): AudioContext | null {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    audioCtx ??= new Ctx();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function loadOrderSound(ctx: AudioContext): Promise<AudioBuffer | null> {
  if (orderBuffer) return Promise.resolve(orderBuffer);
  bufferLoading ??= fetch("/sounds/new-order.wav")
    .then((r) => r.arrayBuffer())
    .then((b) => ctx.decodeAudioData(b))
    .then((buf) => {
      orderBuffer = buf;
      return buf;
    })
    .catch(() => null);
  return bufferLoading;
}

function beep() {
  const ctx = getCtx();
  if (!ctx) return;
  void loadOrderSound(ctx).then((buf) => {
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = ORDER_SOUND_GAIN;
    src.connect(g);
    g.connect(ctx.destination);
    src.start();
  });
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

  // Resume the audio context + preload the bell on the first interaction
  // (browser autoplay rules), so the first order rings instantly and loud.
  useEffect(() => {
    const resume = () => {
      const ctx = getCtx();
      if (ctx) void loadOrderSound(ctx);
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
      {/* sidebar — sticky full-height so the nav stays fully visible while the
          content scrolls (tablet/desktop) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col self-start overflow-y-auto border-r border-black/[0.08] bg-white dark:border-white/5 dark:bg-[#161616] md:flex">
        <div className="flex items-center gap-3 border-b border-black/[0.08] p-5 dark:border-white/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={restaurant.logo}
            alt={restaurant.name}
            className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-black/10 dark:ring-white/15"
          />
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

      {/* mobile tabs — all sections reachable via horizontal scroll */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white dark:border-white/10 dark:bg-[#161616] md:hidden">
        <div className="no-scrollbar flex gap-1 overflow-x-auto px-1 py-1">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setTab(n.id)}
              className={cn(
                "flex shrink-0 flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px]",
                tab === n.id ? "text-brand-secondary" : "text-neutral-500"
              )}
            >
              {n.icon}
              {n.label.split(" ")[0]}
            </button>
          ))}
        </div>
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

        {/* Keyed motion.div (no AnimatePresence "wait"): switching tabs mounts
            the new content immediately. A wait-for-exit wrapper could stall here
            because live tabs (kitchen polling, confirm states) keep re-rendering
            and interrupt the exit animation, leaving the next tab blank until a
            refresh. */}
        <StaffPasswordBanner />

        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {tab === "dashboard" && (
              <Dashboard summary={summary} restaurantId={restaurantId} />
            )}
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
              <Orders restaurantId={restaurantId} onOpen={setOpenOrderId} />
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
function Dashboard({
  summary,
  restaurantId,
}: {
  summary: AdminSummary | null;
  restaurantId: string;
}) {
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

      {/* Money breakdown for today — cash vs card, plus the total. */}
      <div className={CARD}>
        <p className="mb-3 flex items-center gap-2 font-display font-bold text-neutral-900 dark:text-white">
          <Coins className="h-4 w-4 text-brand-accent" /> Tržby dnes — hotovosť /
          karta
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-black/[0.03] px-4 py-3 dark:bg-white/[0.04]">
            <p className="text-xs text-neutral-500">Hotovosť</p>
            <p className="font-display text-xl font-extrabold text-neutral-900 dark:text-white">
              {summary ? eur(summary.cashToday) : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-black/[0.03] px-4 py-3 dark:bg-white/[0.04]">
            <p className="text-xs text-neutral-500">Karta</p>
            <p className="font-display text-xl font-extrabold text-neutral-900 dark:text-white">
              {summary ? eur(summary.cardToday) : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-brand-primary/10 px-4 py-3">
            <p className="text-xs text-neutral-500">Spolu</p>
            <p className="font-display text-xl font-extrabold text-brand-primary">
              {summary ? eur(summary.revenueToday) : "—"}
            </p>
          </div>
        </div>
      </div>

      <ShiftsReport restaurantId={restaurantId} />
    </div>
  );
}

// ---------------- KITCHEN DISPLAY (real orders) ----------------
// First-letter initials of the driver who delivered the order (e.g. "Daniel
// Pekný" → "DP"), shown as a small avatar in the orders list and detail.
function driverInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// Give each driver a stable, distinct colour (hashed from their name) so orders
// are easy to tell apart at a glance.
const DRIVER_COLORS = [
  "#E85D04", "#2E7D32", "#1565C0", "#6A1B9A",
  "#00838F", "#C2185B", "#B8860B", "#4E342E",
];
function driverColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return DRIVER_COLORS[h % DRIVER_COLORS.length];
}

// Clock time an order came in (HH:MM), shown on the kitchen cards.
function orderTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("sk-SK", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
  // FIFO: oldest first, and never reordered by status changes — the first order
  // in stays at the top, new ones queue behind it.
  const active = (
    summary?.orders.filter((o) =>
      ["received", "accepted", "preparing", "ready"].includes(o.status)
    ) ?? []
  )
    .slice()
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    id: string;
    kind: "advance" | "return";
  } | null>(null);
  const [error, setError] = useState("");

  async function run(id: string, kind: "advance" | "return") {
    setBusyId(id);
    setError("");
    try {
      const res =
        kind === "advance"
          ? await advanceKitchenOrder(id)
          : await returnKitchenOrder(id);
      if (!res.ok) setError(res.error ?? "Akcia zlyhala.");
      setConfirm(null);
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      {/* LEFT — prep board. The admin can move orders through prep, but every
          step asks for confirmation so nothing changes by a mis-tap. */}
      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-neutral-500">
            {active.length} v príprave · ~{summary?.waitMinutes ?? "—"} min
            čakanie · aktualizuje sa každých 5 s
          </p>
        </div>
        <p className="mb-3 text-xs text-neutral-400">
          Posúvate stav prípravy (s potvrdením) — alebo to nechajte na kuchára.
          Vpravo vydávate hotové objednávky na odber.
        </p>
        {error && (
          <p className="mb-3 rounded-xl bg-brand-error/10 px-3 py-2 text-xs text-brand-error">
            {error}
          </p>
        )}
        {active.length === 0 ? (
          <div className={cn(CARD, "py-16 text-center text-neutral-500")}>
            <ChefHat className="mx-auto mb-3 h-10 w-10 opacity-40" />
            Žiadne aktívne objednávky.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {active.map((o) => {
              const isConfirming = confirm?.id === o.id;
              const advanceLabel =
                o.status === "preparing" ? "Označiť hotové" : "Začať prípravu";
              return (
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
                    <Clock className="h-3 w-3" />
                    <span className="font-semibold text-neutral-500 dark:text-neutral-300">
                      {orderTime(o.createdAt)}
                    </span>{" "}
                    · pred {o.minsAgo} min · {o.customerName}
                  </p>
                  <ul className="my-3 space-y-1 text-sm text-neutral-800 dark:text-neutral-200">
                    {o.lines.map((it, i) => (
                      <li key={i}>
                        • {it.quantity}× {it.name}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.06] px-3 py-1 text-sm font-semibold text-neutral-900 dark:bg-white/10 dark:text-white">
                      {STATUS_LABEL[o.status]}
                    </span>

                    {isConfirming ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                          Naozaj?
                        </span>
                        <button
                          disabled={busyId === o.id}
                          onClick={() => run(o.id, confirm!.kind)}
                          className="rounded-full bg-brand-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                        >
                          Áno
                        </button>
                        <button
                          onClick={() => setConfirm(null)}
                          className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold dark:border-white/15"
                        >
                          Zrušiť
                        </button>
                      </div>
                    ) : o.status === "ready" ? (
                      <button
                        onClick={() => setConfirm({ id: o.id, kind: "return" })}
                        className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-black/5 dark:border-white/15 dark:text-neutral-300 dark:hover:bg-white/5"
                      >
                        Vrátiť do prípravy
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirm({ id: o.id, kind: "advance" })}
                        className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white dark:bg-white dark:text-brand-dark"
                      >
                        {advanceLabel}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT — counter handover (výdaj) for ready pickup orders. */}
      <Handover restaurantId={restaurantId} />
    </div>
  );
}

// A selectable "wallet" chip for a driver, colour-matched to the orders list
// (same driverColor hash) so the same person reads the same everywhere.
function WalletBall({
  name,
  active,
  onClick,
}: {
  name: string;
  active: boolean;
  onClick: () => void;
}) {
  const color = driverColor(name);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border-2 px-2.5 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "bg-black/[0.03] dark:bg-white/5"
          : "border-transparent opacity-70 hover:opacity-100"
      )}
      style={active ? { borderColor: color, color } : { color }}
    >
      <span
        className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold"
        style={{ backgroundColor: `${color}26`, color }}
      >
        {driverInitials(name)}
      </span>
      {name}
      {active && <Check className="h-3.5 w-3.5" />}
    </button>
  );
}

// Counter handover: ready pickup orders light up here (mirrors the driver board
// for delivery). The admin hands the order over and marks it paid, which
// finalises it.
function Handover({ restaurantId }: { restaurantId: string }) {
  const [orders, setOrders] = useState<DispatchOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [drivers, setDrivers] = useState<ShiftDriver[]>([]);
  // Which driver's wallet each waiting order's cash goes into (order id → driver id).
  const [wallet, setWallet] = useState<Record<string, string>>({});
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(() => {
    getHandoverBoard()
      .then((o) => {
        setOrders(o);
        setLoaded(true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    timer.current = setInterval(refresh, 5000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [refresh]);

  useEffect(() => {
    getShiftDrivers(restaurantId).then(setDrivers).catch(() => setDrivers([]));
  }, [restaurantId]);

  // With a single driver on shift, everything goes to them — no need to pick.
  const soleDriver = drivers.length === 1 ? drivers[0] : null;

  async function settle(id: string) {
    // Cash must land in a courier's wallet. One driver → auto; otherwise the
    // admin must have picked who took it.
    const walletId = soleDriver ? soleDriver.id : wallet[id];
    if (!walletId) {
      setError("Najprv vyberte, kto objednávku prevzal.");
      return;
    }
    setBusyId(id);
    setError("");
    try {
      const res = await markDispatchPaid(id, walletId);
      if (!res.ok) setError(res.error ?? "Akcia zlyhala.");
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  const waiting = orders.filter((o) => !o.paid);
  const done = orders.filter((o) => o.paid);

  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white p-4 dark:border-white/5 dark:bg-[#161616]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display font-bold text-neutral-900 dark:text-white">
          <PackageCheck className="h-5 w-5 text-brand-primary" /> Výdaj (odber)
        </h3>
        <button
          onClick={refresh}
          className="rounded-full p-2 text-neutral-400 hover:bg-black/5 dark:hover:bg-white/10"
          aria-label="Obnoviť"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <p className="mb-3 rounded-xl bg-brand-error/10 px-3 py-2 text-xs text-brand-error">
          {error}
        </p>
      )}

      {!loaded ? (
        <p className="py-10 text-center text-sm text-neutral-500">Načítavam…</p>
      ) : waiting.length === 0 && done.length === 0 ? (
        <div className="py-10 text-center text-sm text-neutral-400">
          Žiadne objednávky na výdaj.
          <p className="mt-1 text-xs text-neutral-400">
            Hotové objednávky na odber sa zobrazia tu.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {waiting.map((o) => (
              <motion.div
                layout
                key={o.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="rounded-xl border border-brand-primary/40 bg-brand-primary/[0.06] p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display font-extrabold text-neutral-900 dark:text-white">
                    #{o.id}
                  </span>
                  <span className="font-display font-extrabold text-brand-primary">
                    {eur(o.total)}
                  </span>
                </div>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-400">
                  <Clock className="h-3 w-3" /> pred {o.minsAgo} min ·{" "}
                  {o.customerName}
                </p>
                {o.phone && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-neutral-800 dark:text-neutral-100">
                    <Phone className="h-4 w-4 shrink-0 text-brand-success" />
                    <a
                      href={`tel:${o.phone.replace(/[^+\d]/g, "")}`}
                      className="select-all tabular-nums hover:text-brand-primary"
                    >
                      {o.phone}
                    </a>
                  </p>
                )}
                <ul className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                  {o.lines.map((l, i) => (
                    <li key={i}>
                      {l.quantity}× {l.name}
                    </li>
                  ))}
                </ul>
                {o.note && (
                  <p className="mt-1 rounded-lg bg-black/[0.04] px-2 py-1 text-xs text-neutral-500 dark:bg-white/5">
                    {o.note}
                  </p>
                )}
                {/* Whose wallet the cash goes into. All takings are tracked per
                    courier, so the admin must attribute a counter payment to a
                    driver before settling. One driver on shift → automatic. */}
                <div className="mt-3 border-t border-black/[0.06] pt-2 dark:border-white/10">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    Kto prevzal (peňaženka)
                  </p>
                  {drivers.length === 0 ? (
                    <p className="text-xs text-brand-error">
                      Dnes nie je pridelený rozvozca — nastavte službu v
                      Prevádzke.
                    </p>
                  ) : soleDriver ? (
                    <WalletBall
                      name={soleDriver.name}
                      active
                      onClick={() => {}}
                    />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {drivers.map((d) => (
                        <WalletBall
                          key={d.id}
                          name={d.name}
                          active={wallet[o.id] === d.id}
                          onClick={() =>
                            setWallet((w) => ({ ...w, [o.id]: d.id }))
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    disabled={
                      busyId === o.id ||
                      drivers.length === 0 ||
                      (!soleDriver && !wallet[o.id])
                    }
                    onClick={() => settle(o.id)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand-success px-3 py-2 text-xs font-bold text-white transition-colors hover:brightness-110 disabled:opacity-40"
                  >
                    <Check className="h-4 w-4" /> Vydané a zaplatené
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {done.map((o) => (
            <div
              key={o.id}
              className="flex items-center justify-between rounded-xl border border-brand-success/40 bg-brand-success/[0.07] px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-1.5 font-semibold text-brand-success">
                <CheckCheck className="h-4 w-4" /> #{o.id} vydané
              </span>
              <span className="text-xs text-neutral-500">{eur(o.total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- ORDERS (real, clickable) ----------------
function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold capitalize transition-colors",
        active
          ? "bg-brand-primary text-white"
          : "bg-black/[0.05] text-neutral-600 hover:bg-black/10 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10"
      )}
    >
      {children}
    </button>
  );
}

function Orders({
  restaurantId,
  onOpen,
}: {
  restaurantId: string;
  onOpen: (id: string) => void;
}) {
  const [days, setDays] = useState<string[]>([]);
  const [day, setDay] = useState<string | null>(null); // null = všetky (recent)
  const [rows, setRows] = useState<AdminOrderRow[] | null>(null);

  useEffect(() => {
    getOrderDays(restaurantId).then(setDays).catch(() => setDays([]));
  }, [restaurantId]);

  const load = useCallback(() => {
    getAdminOrdersByDay(restaurantId, day)
      .then(setRows)
      .catch(() => setRows([]));
  }, [restaurantId, day]);
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  // today / yesterday in the Europe/Bratislava calendar
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bratislava",
  }).format(new Date());
  const yDate = new Date(todayStr + "T00:00:00");
  yDate.setDate(yDate.getDate() - 1);
  const yesterdayStr = `${yDate.getFullYear()}-${String(
    yDate.getMonth() + 1
  ).padStart(2, "0")}-${String(yDate.getDate()).padStart(2, "0")}`;

  function dayLabel(d: string): string {
    if (d === todayStr) return "Dnes";
    if (d === yesterdayStr) return "Včera";
    const [, m, dd] = d.split("-");
    return `${Number(dd)}.${Number(m)}.`;
  }

  const list = rows ?? [];

  return (
    <div className="space-y-4">
      {/* day filter — only days that actually have orders */}
      <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1">
        <FilterChip active={day === null} onClick={() => setDay(null)}>
          Všetky
        </FilterChip>
        {days.map((d) => (
          <FilterChip key={d} active={day === d} onClick={() => setDay(d)}>
            {dayLabel(d)}
          </FilterChip>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-black/[0.06] dark:bg-[#1a1a1a] dark:ring-white/5">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/[0.08] text-neutral-500 dark:border-white/5">
            <tr>
              {["ID", "Zákazník", "Typ", "Suma", "Stav", "Doručil", ""].map(
                (h) => (
                  <th key={h} className="p-4 font-semibold">
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {rows !== null && list.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-neutral-500">
                  Žiadne objednávky.
                </td>
              </tr>
            )}
            {list.map((r) => {
              const color = r.driverName ? driverColor(r.driverName) : null;
              return (
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
                  <td className="p-4">
                    {r.driverName && color ? (
                      <span
                        className="inline-flex items-center gap-2"
                        title={`Doručil: ${r.driverName}`}
                      >
                        <span
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                          style={{ backgroundColor: `${color}26`, color }}
                        >
                          {driverInitials(r.driverName)}
                        </span>
                        <span
                          className="hidden whitespace-nowrap text-xs font-semibold lg:inline"
                          style={{ color }}
                        >
                          {r.driverName}
                        </span>
                      </span>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="p-4 text-right text-xs font-semibold text-brand-secondary">
                    Detail →
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
  const [surBusy, setSurBusy] = useState(false);

  const reload = useCallback(() => {
    return getOrderDetail(restaurantId, id).then(setDetail);
  }, [restaurantId, id]);

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

  async function toggleSurcharge(on: boolean) {
    setSurBusy(true);
    try {
      await setOrderSurcharge(id, on);
      await reload();
    } finally {
      setSurBusy(false);
    }
  }

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
              {detail.driverName && (
                <Info label="Doručil" value={detail.driverName} />
              )}
            </div>

            {detail.note && (
              <div className="flex items-start gap-2 rounded-2xl border border-amber-400/50 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-700 dark:text-amber-300">
                <StickyNote className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{detail.note}</span>
              </div>
            )}

            {/* Custom-request surcharge (e.g. half-and-half pizza). Toggleable
                until the order is paid. */}
            <button
              disabled={surBusy || detail.status === "delivered"}
              onClick={() => toggleSurcharge(detail.surcharge <= 0)}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50",
                detail.surcharge > 0
                  ? "border-brand-primary/50 bg-brand-primary/10 text-brand-primary"
                  : "border-black/10 text-neutral-600 hover:bg-black/[0.03] dark:border-white/15 dark:text-neutral-300 dark:hover:bg-white/5"
              )}
            >
              <span className="flex items-center gap-2">
                <Pizza className="h-4 w-4" /> Pol/pol pizza · príplatok{" "}
                {eur(POL_POL_SURCHARGE)}
              </span>
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full border",
                  detail.surcharge > 0
                    ? "border-brand-primary bg-brand-primary text-white"
                    : "border-black/25 dark:border-white/25"
                )}
              >
                {detail.surcharge > 0 && <Check className="h-3.5 w-3.5" />}
              </span>
            </button>

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
                    {l.note && (
                      <p className="mt-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                        → {l.note}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-1 border-t border-dashed border-black/10 pt-3 dark:border-white/10">
              <Row label="Medzisúčet" value={eur(detail.subtotal)} />
              <Row label="Doprava" value={eur(detail.deliveryFee)} />
              {detail.surcharge > 0 && (
                <Row
                  label={detail.surchargeNote ?? "Príplatok"}
                  value={eur(detail.surcharge)}
                />
              )}
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
      <ServiceOpen restaurantId={restaurantId} />

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

      <TipCalculator restaurantId={restaurantId} />

      <PruneOrders restaurantId={restaurantId} onDone={refresh} />

      {/* Password change + operator contact — staff-only, kept at the bottom of
          the Prevádzka section (nowhere else in the app). */}
      <div className="grid gap-4 lg:grid-cols-2">
        <StaffPasswordPanel />
        <OperatorContact />
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

// ---------------- TIP SPLIT (end-of-day cash → tringelty) ----------------
const TIP_INPUT =
  "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand-primary dark:border-white/10 dark:bg-[#242424] dark:text-white";

function TipField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-neutral-500">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-neutral-400">{hint}</p>}
    </div>
  );
}

// Count the cash drawer at close, work out the tips (counted − starting float −
// expected cash from orders) and split them equally between everyone on shift.
function TipCalculator({ restaurantId }: { restaurantId: string }) {
  const [data, setData] = useState<TipData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expCash, setExpCash] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [expCard, setExpCard] = useState("");
  const [countedCard, setCountedCard] = useState("");
  const [floatAmt, setFloatAmt] = useState("");
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getTipData(restaurantId)
      .then((d) => {
        setData(d);
        const s = d.saved;
        // Prefill expected from today's orders; if a split was already saved for
        // today, restore exactly what was entered.
        setExpCash(String((s ? s.expectedCash : d.expectedCash) || ""));
        setExpCard(String((s ? s.expectedCard : d.expectedCard) || ""));
        if (s) {
          setCountedCash(s.countedCash ? String(s.countedCash) : "");
          setCountedCard(s.countedCard ? String(s.countedCard) : "");
          setFloatAmt(s.startingFloat ? String(s.startingFloat) : "");
          // Anyone on shift not in the saved allocations was excluded.
          const paid = new Set(s.allocations.map((a) => a.id));
          setExcluded(
            new Set(d.staff.filter((m) => !paid.has(m.id)).map((m) => m.id))
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [restaurantId]);
  useEffect(() => load(), [load]);

  const num = (s: string) => {
    const n = parseFloat(s.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const cashTips = num(countedCash) - num(floatAmt) - num(expCash);
  const cardTips = num(countedCard) - num(expCard);
  const tips = Math.max(0, r2(cashTips + cardTips));
  const included = (data?.staff ?? []).filter((s) => !excluded.has(s.id));
  const per = included.length
    ? Math.floor((tips / included.length) * 100) / 100
    : 0;
  const leftover = r2(tips - per * included.length);

  const roleLabel = (role: string) =>
    role === "driver" ? "Rozvozca" : role === "kuchar" ? "Kuchár" : role;

  function toggle(id: string) {
    setSaved(false);
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Wrap a setter so editing any field clears the "saved" confirmation.
  const edit =
    (setter: (v: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSaved(false);
      setter(e.target.value);
    };

  async function save() {
    if (saving) return;
    setSaving(true);
    const allocations: TipAllocation[] = included.map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      amount: per,
    }));
    const res = await saveTips(restaurantId, {
      expectedCash: num(expCash),
      countedCash: num(countedCash),
      expectedCard: num(expCard),
      countedCard: num(countedCard),
      startingFloat: num(floatAmt),
      tipsTotal: tips,
      allocations,
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      load();
    }
  }

  return (
    <div className={CARD}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-accent/15 text-brand-accent">
            <Coins className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display font-bold text-neutral-900 dark:text-white">
              Tringelty — koniec dňa
            </p>
            <p className="text-sm text-neutral-500">
              Spočítajte hotovosť a rozdeľte prepitné medzi zmenu.
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-full p-2 text-neutral-500 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
          aria-label="Načítať znova"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>

      <div className="space-y-3">
        {/* Cash */}
        <div className="grid gap-3 sm:grid-cols-2">
          <TipField
            label="Očakávaná hotovosť (€)"
            hint={`${data?.cashOrders ?? 0} hotovostných obj. dnes`}
          >
            <input
              inputMode="decimal"
              value={expCash}
              onChange={edit(setExpCash)}
              className={TIP_INPUT}
              placeholder="0"
            />
          </TipField>
          <TipField label="Spočítaná hotovosť (€)" hint="čo je v pokladni">
            <input
              inputMode="decimal"
              value={countedCash}
              onChange={edit(setCountedCash)}
              className={TIP_INPUT}
              placeholder="0"
            />
          </TipField>
        </div>
        {/* Card */}
        <div className="grid gap-3 sm:grid-cols-2">
          <TipField
            label="Očakávaná karta (€)"
            hint={`${data?.cardOrders ?? 0} kartových obj. dnes`}
          >
            <input
              inputMode="decimal"
              value={expCard}
              onChange={edit(setExpCard)}
              className={TIP_INPUT}
              placeholder="0"
            />
          </TipField>
          <TipField label="Spočítaná karta (€)" hint="z terminálu">
            <input
              inputMode="decimal"
              value={countedCard}
              onChange={edit(setCountedCard)}
              className={TIP_INPUT}
              placeholder="0"
            />
          </TipField>
        </div>
        <TipField label="Počiatočný vklad (€)" hint="nepovinné — odráta sa z hotovosti">
          <input
            inputMode="decimal"
            value={floatAmt}
            onChange={edit(setFloatAmt)}
            className={cn(TIP_INPUT, "sm:max-w-[240px]")}
            placeholder="0"
          />
        </TipField>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl bg-brand-primary/10 px-4 py-3">
        <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
          Tringelty spolu
        </span>
        <span className="font-display text-2xl font-extrabold text-brand-primary">
          {eur(tips)}
        </span>
      </div>

      <div className="mt-4">
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
          <Users className="h-4 w-4 text-brand-secondary" /> Rozdelenie na zmenu
          {included.length > 0 && (
            <span className="text-xs font-normal text-neutral-500">
              · {eur(per)} / os.
            </span>
          )}
        </p>
        {(data?.staff.length ?? 0) === 0 ? (
          <p className="text-sm text-neutral-500">
            Dnes nemá nikto zmenu. Zmeny sa zadávajú pri otvorení prevádzky.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {data!.staff.map((s) => {
              const on = !excluded.has(s.id);
              return (
                <li
                  key={s.id}
                  className={cn(
                    "flex items-center justify-between rounded-xl border px-3 py-2",
                    on
                      ? "border-brand-primary/30 bg-brand-primary/[0.04]"
                      : "border-black/10 opacity-60 dark:border-white/10"
                  )}
                >
                  <label className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(s.id)}
                      className="h-4 w-4 accent-brand-primary"
                    />
                    <span className="text-sm font-medium text-neutral-900 dark:text-white">
                      {s.name}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {roleLabel(s.role)}
                    </span>
                  </label>
                  <span className="font-semibold tabular-nums text-neutral-900 dark:text-white">
                    {on ? eur(per) : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {leftover > 0 && included.length > 0 && (
          <p className="mt-2 text-xs text-neutral-500">
            Zvyšok po zaokrúhlení: {eur(leftover)} — rozdeľte ručne.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-4 dark:border-white/5">
        <div className="text-xs text-neutral-500">
          {data?.saved ? (
            <>
              Naposledy uložené{" "}
              {new Date(data.saved.updatedAt).toLocaleString("sk-SK", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {data.saved.savedByEmail ? ` · ${data.saved.savedByEmail}` : ""}
            </>
          ) : (
            "Zatiaľ neuložené pre dnešnú zmenu."
          )}
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-5 py-2.5 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50"
        >
          {saving ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4" />
          ) : (
            <Coins className="h-4 w-4" />
          )}
          {saving ? "Ukladám…" : saved ? "Uložené ✓" : "Uložiť na zmenu"}
        </button>
      </div>
    </div>
  );
}

// ---------------- DAILY OPEN (availability + staff shifts) ----------------
function ServiceOpen({ restaurantId }: { restaurantId: string }) {
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [prep, setPrep] = useState<OpenPrep | null>(null);
  const [loadingPrep, setLoadingPrep] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);

  const load = useCallback(() => {
    getServiceStatus(restaurantId).then(setStatus).catch(() => {});
  }, [restaurantId]);
  useEffect(() => load(), [load]);

  async function startOpen() {
    setLoadingPrep(true);
    try {
      setPrep(await getOpenPrep(restaurantId));
    } finally {
      setLoadingPrep(false);
    }
  }

  async function doClose() {
    setClosing(true);
    try {
      await closeRestaurant(restaurantId);
      setConfirmClose(false);
      load();
    } finally {
      setClosing(false);
    }
  }

  const open = status?.open ?? false;
  const showButton = open || status?.canOpenNow;

  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center",
        open
          ? "border-brand-success/40 bg-brand-success/10"
          : "border-black/[0.08] bg-white dark:border-white/5 dark:bg-[#1a1a1a]"
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl",
            open
              ? "bg-brand-success/15 text-brand-success"
              : "bg-brand-secondary/15 text-brand-secondary"
          )}
        >
          <DoorOpen className="h-5 w-5" />
        </span>
        <div>
          <p className="font-semibold text-neutral-900 dark:text-white">
            {open ? "Prevádzka je dnes otvorená" : "Prevádzka je zatvorená"}
          </p>
          <p className="text-sm text-neutral-500">
            {open
              ? "Prijímame objednávky. Dostupnosť a služby môžete upraviť."
              : status?.closedToday
              ? "Dnes je podľa otváracích hodín zatvorené."
              : status?.canOpenNow
              ? "Otvorte prevádzku pre dnešný deň."
              : status?.openTime
              ? `Otvoriť sa dá hodinu pred otváraním (dnes o ${status.openTime}).`
              : "Načítavam…"}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
        {showButton && (
          <button
            onClick={startOpen}
            disabled={loadingPrep}
            className="rounded-full bg-brand-success px-5 py-2.5 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50"
          >
            {loadingPrep
              ? "Načítavam…"
              : open
              ? "Upraviť dostupnosť / služby"
              : "Otvoriť prevádzku"}
          </button>
        )}
        {open &&
          (confirmClose ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                Naozaj zavrieť?
              </span>
              <button
                onClick={doClose}
                disabled={closing}
                className="rounded-full bg-brand-error px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {closing ? "Zatváram…" : "Áno, zavrieť"}
              </button>
              <button
                onClick={() => setConfirmClose(false)}
                className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold dark:border-white/10"
              >
                Zrušiť
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClose(true)}
              className="rounded-full border border-brand-error/40 px-5 py-2.5 text-sm font-bold text-brand-error hover:bg-brand-error/10"
            >
              Zavrieť prevádzku
            </button>
          ))}
        {/* Test override: open regardless of the opening-hours window. */}
        {!open && (
          <button
            onClick={startOpen}
            disabled={loadingPrep}
            className="rounded-full border border-dashed border-black/20 px-4 py-2 text-xs font-semibold text-neutral-500 hover:bg-black/[0.03] disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/5"
          >
            🧪 Test: otvoriť teraz
          </button>
        )}
      </div>

      {prep && (
        <OpenFlow
          restaurantId={restaurantId}
          prep={prep}
          onClose={() => setPrep(null)}
          onDone={() => {
            setPrep(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function OpenFlow({
  restaurantId,
  prep,
  onClose,
  onDone,
}: {
  restaurantId: string;
  prep: OpenPrep;
  onClose: () => void;
  onDone: () => void;
}) {
  const [unavailable, setUnavailable] = useState<Set<string>>(
    () => new Set(prep.products.filter((p) => p.unavailable).map((p) => p.id))
  );
  const [shift, setShift] = useState<Set<string>>(
    () => new Set(prep.staff.filter((s) => s.onShift).map((s) => s.id))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggle(set: Set<string>, id: string) {
    const n = new Set(set);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  }

  async function confirm() {
    setSaving(true);
    setError("");
    try {
      const res = await openRestaurant(
        restaurantId,
        [...unavailable],
        [...shift]
      );
      if (!res.ok) {
        setError(res.error ?? "Nepodarilo sa otvoriť.");
        return;
      }
      onDone();
    } catch {
      setError("Nepodarilo sa otvoriť. Skúste znova.");
    } finally {
      setSaving(false);
    }
  }

  const cats = Array.from(new Set(prep.products.map((p) => p.category)));

  const offCount = unavailable.size;

  return (
    <Modal title="Otvoriť prevádzku" onClose={onClose} wide>
      <div className="space-y-6">
        {/* Availability */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-display text-base font-bold text-neutral-900 dark:text-white">
              Dostupnosť položiek
            </h4>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold",
                offCount > 0
                  ? "bg-brand-error/10 text-brand-error"
                  : "bg-brand-success/10 text-brand-success"
              )}
            >
              {offCount > 0 ? `${offCount} nedostupných` : "Všetko dostupné"}
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Klepnite na položku, ktorá dnes <strong>nie je</strong> k dispozícii —
            na webe zostane, ale označí sa ako nedostupná a nedá sa objednať.
            Zoznam sa každý deň o 12:00 resetuje na „všetko dostupné“.
          </p>
          <div className="mt-3 max-h-[46vh] space-y-4 overflow-y-auto pr-1">
            {cats.map((cat) => (
              <div key={cat}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  {CATEGORIES.find((c) => c.id === cat)?.name ?? cat}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {prep.products
                    .filter((p) => p.category === cat)
                    .map((p) => {
                      const off = unavailable.has(p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() =>
                            setUnavailable((s) => toggle(s, p.id))
                          }
                          className={cn(
                            "flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                            off
                              ? "border-brand-error/50 bg-brand-error/10"
                              : "border-black/10 hover:border-brand-success/40 hover:bg-black/[0.02] dark:border-white/10 dark:hover:bg-white/5"
                          )}
                        >
                          <span
                            className={cn(
                              "font-medium",
                              off
                                ? "text-brand-error line-through"
                                : "text-neutral-900 dark:text-white"
                            )}
                          >
                            {p.name}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
                              off
                                ? "bg-brand-error/15 text-brand-error"
                                : "bg-brand-success/15 text-brand-success"
                            )}
                          >
                            {off ? "Nedostupné" : "Dostupné"}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Staff shifts */}
        <div>
          <h4 className="font-display font-bold text-neutral-900 dark:text-white">
            Kto má dnes službu?
          </h4>
          <p className="mt-1 text-xs text-neutral-500">
            Len vybraní zamestnanci môžu dnes pracovať. Služba sa zapíše k
            dnešnému dňu.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {prep.staff.length === 0 && (
              <p className="text-sm text-neutral-500">
                Žiadni zamestnanci pre túto prevádzku.
              </p>
            )}
            {prep.staff.map((s) => {
              const on = shift.has(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => setShift((v) => toggle(v, s.id))}
                  className={cn(
                    "flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                    on
                      ? "border-brand-success/50 bg-brand-success/10"
                      : "border-black/10 dark:border-white/10"
                  )}
                >
                  <span>
                    <span className="font-semibold text-neutral-900 dark:text-white">
                      {s.name}
                    </span>
                    <span className="ml-1 text-xs text-neutral-400">
                      {s.role === "kuchar" ? "kuchár" : "rozvoz"}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full",
                      on
                        ? "bg-brand-success text-white"
                        : "border border-black/15 dark:border-white/20"
                    )}
                  >
                    {on && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="text-sm text-brand-error">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold dark:border-white/10"
          >
            Zrušiť
          </button>
          <button
            onClick={confirm}
            disabled={saving}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {saving ? "Otváram…" : "Potvrdiť a otvoriť"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Housekeeping: delete orders older than two weeks (with confirmation).
function PruneOrders({
  restaurantId,
  onDone,
}: {
  restaurantId: string;
  onDone: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  async function run() {
    setBusy(true);
    try {
      const res = await resetOldOrders(restaurantId);
      setResult(`Vymazaných objednávok: ${res.deleted}.`);
      onDone();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <div className={CARD}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-error/15 text-brand-error">
            <Trash2 className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold text-neutral-900 dark:text-white">
              Vymazať staré objednávky
            </p>
            <p className="text-sm text-neutral-500">
              Natrvalo odstráni objednávky staršie ako 2 týždne.
            </p>
          </div>
        </div>
        {confirming ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
              Naozaj?
            </span>
            <button
              onClick={run}
              disabled={busy}
              className="rounded-full bg-brand-error px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? "Mažem…" : "Áno, vymazať"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold dark:border-white/10"
            >
              Zrušiť
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="shrink-0 rounded-full border border-brand-error/40 px-5 py-2.5 text-sm font-bold text-brand-error hover:bg-brand-error/10"
          >
            Vymazať staršie ako 2 týždne
          </button>
        )}
      </div>
      {result && (
        <p className="mt-3 text-sm font-semibold text-brand-success">{result}</p>
      )}
    </div>
  );
}

// Who worked which days + the orders/revenue booked on each day. Each day opens
// to show the full detail: staff, cash/card split and the saved tip allocation.
function ShiftsReport({ restaurantId }: { restaurantId: string }) {
  const [days, setDays] = useState<ShiftDay[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, ShiftDayDetail>>({});
  const [loadingDay, setLoadingDay] = useState<string | null>(null);

  useEffect(() => {
    getShiftsReport(restaurantId)
      .then(setDays)
      .catch(() => setDays([]));
  }, [restaurantId]);

  const roleLabel = (role: string) =>
    role === "driver" ? "Rozvozca" : role === "kuchar" ? "Kuchár" : role;

  function toggle(date: string) {
    if (open === date) {
      setOpen(null);
      return;
    }
    setOpen(date);
    if (!details[date]) {
      setLoadingDay(date);
      getShiftDayDetail(restaurantId, date)
        .then((d) => setDetails((prev) => ({ ...prev, [date]: d })))
        .catch(() => {})
        .finally(() => setLoadingDay(null));
    }
  }

  return (
    <div className={CARD}>
      <h3 className="mb-4 flex items-center gap-2 font-display font-bold text-neutral-900 dark:text-white">
        <CalendarDays className="h-5 w-5 text-brand-secondary" /> Služby a tržby
        po dňoch
      </h3>
      {!days ? (
        <p className="text-sm text-neutral-500">Načítavam…</p>
      ) : days.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Zatiaľ žiadne zaznamenané služby. Zapíšu sa pri otvorení prevádzky.
        </p>
      ) : (
        <div className="space-y-2">
          {days.map((d) => {
            const isOpen = open === d.serviceDate;
            const detail = details[d.serviceDate];
            return (
              <div
                key={d.serviceDate}
                className="overflow-hidden rounded-xl border border-black/[0.06] dark:border-white/5"
              >
                <button
                  onClick={() => toggle(d.serviceDate)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                >
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-neutral-400 transition-transform",
                      isOpen && "rotate-180"
                    )}
                  />
                  <span className="w-24 shrink-0 font-medium text-neutral-900 dark:text-white">
                    {d.serviceDate}
                  </span>
                  <span className="hidden flex-1 items-center gap-1 truncate text-neutral-500 sm:flex">
                    <Users className="h-3.5 w-3.5 text-brand-secondary" />
                    {d.staff.length ? d.staff.join(", ") : "—"}
                  </span>
                  <span className="ml-auto shrink-0 text-neutral-500">
                    {d.orders} obj.
                  </span>
                  <span className="w-20 shrink-0 text-right font-semibold text-brand-primary">
                    {eur(d.revenue)}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-black/[0.06] bg-black/[0.015] px-4 py-3 dark:border-white/5 dark:bg-white/[0.02]">
                    {!detail ? (
                      <p className="text-sm text-neutral-500">
                        {loadingDay === d.serviceDate
                          ? "Načítavam…"
                          : "—"}
                      </p>
                    ) : (
                      <div className="space-y-3 text-sm">
                        {/* money split */}
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <DayStat label="Objednávky" value={String(detail.orders)} />
                          <DayStat label="Hotovosť" value={eur(detail.cash)} />
                          <DayStat label="Karta" value={eur(detail.card)} />
                          <DayStat label="Tržba spolu" value={eur(detail.revenue)} accent />
                        </div>

                        {/* staff */}
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                            Na zmene
                          </p>
                          {detail.staff.length === 0 ? (
                            <p className="text-neutral-500">—</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {detail.staff.map((s, i) => (
                                <span
                                  key={i}
                                  className="rounded-full bg-black/[0.05] px-2.5 py-1 text-xs dark:bg-white/[0.06]"
                                >
                                  {s.name}
                                  <span className="text-neutral-400">
                                    {" "}
                                    · {roleLabel(s.role)}
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* tips */}
                        <div>
                          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                            <Coins className="h-3.5 w-3.5" /> Tringelty
                          </p>
                          {!detail.tips ? (
                            <p className="text-neutral-500">
                              Neuložené pre tento deň.
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-neutral-500">Spolu</span>
                                <span className="font-display text-lg font-extrabold text-brand-primary">
                                  {eur(detail.tips.tipsTotal)}
                                </span>
                              </div>
                              <ul className="space-y-1">
                                {detail.tips.allocations.map((a, i) => (
                                  <li
                                    key={i}
                                    className="flex items-center justify-between rounded-lg bg-white px-3 py-1.5 dark:bg-white/[0.04]"
                                  >
                                    <span>
                                      {a.name}
                                      <span className="text-xs text-neutral-400">
                                        {" "}
                                        · {roleLabel(a.role)}
                                      </span>
                                    </span>
                                    <span className="font-semibold tabular-nums">
                                      {eur(a.amount)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                              {detail.tips.savedByEmail && (
                                <p className="text-[11px] text-neutral-400">
                                  Uložil: {detail.tips.savedByEmail}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DayStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg bg-white px-3 py-2 dark:bg-white/[0.04]">
      <p className="text-[11px] text-neutral-500">{label}</p>
      <p
        className={cn(
          "font-semibold",
          accent
            ? "text-brand-primary"
            : "text-neutral-900 dark:text-white"
        )}
      >
        {value}
      </p>
    </div>
  );
}

// ---------------- PRODUCTS (DB-backed CRUD) ----------------
const BADGE_OPTIONS: { id: Badge; label: string }[] = [
  { id: "bestseller", label: "Bestseller" },
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
    try {
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
      if (!res.ok) {
        setError(res.error ?? "Nepodarilo sa uložiť.");
        return;
      }
      onSaved();
    } catch {
      setError("Produkt sa nepodarilo uložiť. Skúste znova.");
    } finally {
      setSaving(false);
    }
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
          <p className="mb-2 text-xs text-neutral-500">
            Štítok „Bestseller“ zaradí produkt do sekcie{" "}
            <strong>Bestsellery</strong> na hlavnej stránke.
          </p>
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

// Shared Save / Revert bar with a two-step "really save?" confirmation, used by
// the Zones and Coupons editors so a single click doesn't persist silently and
// unsaved edits can be thrown away.
function SaveBar({
  dirty,
  saving,
  saved,
  error,
  onSave,
  onRevert,
}: {
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  error?: string;
  onSave: () => void;
  onRevert: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!dirty) setConfirming(false);
  }, [dirty]);

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">
          Naozaj uložiť zmeny?
        </span>
        <button
          onClick={() => {
            setConfirming(false);
            onSave();
          }}
          disabled={saving}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {saving ? "Ukladám…" : "Áno, uložiť"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold dark:border-white/10"
        >
          Zrušiť
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && <span className="text-sm text-brand-error">{error}</span>}
      <button
        onClick={onRevert}
        disabled={!dirty || saving}
        className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-neutral-600 disabled:opacity-40 dark:border-white/10 dark:text-neutral-300"
      >
        Vrátiť zmeny
      </button>
      <button
        onClick={() => setConfirming(true)}
        disabled={saving || !dirty}
        className="btn-primary text-sm disabled:opacity-50"
      >
        {saved && !dirty ? "Uložené ✓" : "Uložiť zmeny"}
      </button>
    </div>
  );
}

// ---------------- DELIVERY ZONES (DB-backed) ----------------
function Zones({ restaurantId }: { restaurantId: string }) {
  const [zones, setZones] = useState<DeliveryZone[] | null>(null);
  const [newArea, setNewArea] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(() => {
    setDirty(false);
    setSaved(false);
    adminGetZones(restaurantId).then(setZones).catch(() => setZones([]));
  }, [restaurantId]);
  useEffect(() => load(), [load]);

  function update(id: string, patch: Partial<DeliveryZone>) {
    setZones((zs) => (zs ? zs.map((z) => (z.id === id ? { ...z, ...patch } : z)) : zs));
    setDirty(true);
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
    setDirty(true);
    setSaved(false);
  }
  function removeZone(id: string) {
    setZones((zs) => (zs ? zs.filter((z) => z.id !== id) : zs));
    setDirty(true);
    setSaved(false);
  }
  async function persist() {
    if (!zones) return;
    setSaving(true);
    await saveZones(restaurantId, zones);
    setSaving(false);
    setSaved(true);
    setDirty(false);
  }

  if (!zones) return <p className="text-sm text-neutral-500">Načítavam zóny…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-500">
          Upravte zóny, poplatky a zoznam ulíc/obcí. Nezabudnite uložiť.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={addZone} className="btn-ghost text-sm">
            <Plus className="h-4 w-4" /> Pridať zónu
          </button>
          <SaveBar
            dirty={dirty}
            saving={saving}
            saved={saved}
            onSave={persist}
            onRevert={load}
          />
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          <p className="mt-2 text-xs text-neutral-500">
            Min. objednávka 0 € = bez limitu. Napr. 20 € znamená, že do tejto
            zóny doručíme až od 20 €.
          </p>
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

// ---------------- COUPONS (DB-backed, single-save editor) ----------------
type EditCoupon = {
  key: string; // stable React key (code is user-editable)
  code: string;
  type: "percentage" | "fixed" | "free_delivery";
  value: number;
  minSubtotal: number;
  label: string;
  forAll: boolean;
};

let couponKeySeq = 0;
const nextCouponKey = () => `coupon-${Date.now()}-${couponKeySeq++}`;

function Coupons({ restaurantId }: { restaurantId: string }) {
  const [coupons, setCoupons] = useState<EditCoupon[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setDirty(false);
    setSaved(false);
    setError("");
    adminGetCoupons(restaurantId)
      .then((cs) =>
        setCoupons(
          cs.map((c) => ({
            key: c.code,
            code: c.code,
            type: c.type,
            value: c.value,
            minSubtotal: c.minSubtotal,
            label: c.label,
            forAll: c.restaurantId === "all",
          }))
        )
      )
      .catch(() => setCoupons([]));
  }, [restaurantId]);
  useEffect(() => load(), [load]);

  function update(key: string, patch: Partial<EditCoupon>) {
    setCoupons((cs) =>
      cs ? cs.map((c) => (c.key === key ? { ...c, ...patch } : c)) : cs
    );
    setDirty(true);
    setSaved(false);
    setError("");
  }
  function addCoupon() {
    setCoupons((cs) => [
      ...(cs ?? []),
      {
        key: nextCouponKey(),
        code: "",
        type: "percentage",
        value: 10,
        minSubtotal: 0,
        label: "",
        forAll: false,
      },
    ]);
    setDirty(true);
    setSaved(false);
  }
  function removeCoupon(key: string) {
    setCoupons((cs) => (cs ? cs.filter((c) => c.key !== key) : cs));
    setDirty(true);
    setSaved(false);
  }
  async function persist() {
    if (!coupons) return;
    setSaving(true);
    setError("");
    const payload: CouponInput[] = coupons.map((c) => ({
      code: c.code,
      type: c.type,
      value: c.value,
      minSubtotal: c.minSubtotal,
      label: c.label,
      forAll: c.forAll,
    }));
    const res = await saveCoupons(restaurantId, payload);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "Nepodarilo sa uložiť.");
      return;
    }
    setSaved(true);
    setDirty(false);
  }

  if (!coupons)
    return <p className="text-sm text-neutral-500">Načítavam kupóny…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-500">
          Upravte kupóny a uložte naraz jedným tlačidlom.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={addCoupon} className="btn-ghost text-sm">
            <Plus className="h-4 w-4" /> Pridať kupón
          </button>
          <SaveBar
            dirty={dirty}
            saving={saving}
            saved={saved}
            error={error}
            onSave={persist}
            onRevert={load}
          />
        </div>
      </div>

      {coupons.length === 0 && (
        <p className="text-sm text-neutral-500">
          Zatiaľ žiadne kupóny. Pridajte prvý.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {coupons.map((c) => (
          <div key={c.key} className={CARD}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Kupón
              </span>
              <button
                onClick={() => removeCoupon(c.key)}
                className="flex items-center gap-1 text-xs font-semibold text-neutral-400 hover:text-brand-error"
              >
                <Trash2 className="h-3.5 w-3.5" /> Zmazať
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel>Kód</FieldLabel>
                <input
                  value={c.code}
                  onChange={(e) =>
                    update(c.key, { code: e.target.value.toUpperCase() })
                  }
                  placeholder="napr. LETO2026"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="w-full rounded-lg border border-black/10 bg-neutral-100 px-3 py-2 text-sm uppercase outline-none focus:border-brand-primary dark:border-white/10 dark:bg-[#222]"
                />
              </div>
              <div>
                <FieldLabel>Typ</FieldLabel>
                <select
                  value={c.type}
                  onChange={(e) =>
                    update(c.key, {
                      type: e.target.value as EditCoupon["type"],
                    })
                  }
                  className="w-full rounded-lg border border-black/10 bg-neutral-100 px-3 py-2 text-sm outline-none focus:border-brand-primary dark:border-white/10 dark:bg-[#222]"
                >
                  <option value="percentage">Percentuálna zľava</option>
                  <option value="fixed">Pevná zľava (€)</option>
                  <option value="free_delivery">Doprava zdarma</option>
                </select>
              </div>
              {c.type !== "free_delivery" && (
                <NumInput
                  label={c.type === "percentage" ? "Zľava (%)" : "Zľava (€)"}
                  value={c.value}
                  onChange={(v) => update(c.key, { value: v })}
                />
              )}
              <NumInput
                label="Platí od sumy (€)"
                value={c.minSubtotal}
                onChange={(v) => update(c.key, { minSubtotal: v })}
              />
              <div className="sm:col-span-2">
                <TextInput
                  label="Popis (pre zákazníka)"
                  value={c.label}
                  onChange={(v) => update(c.key, { label: v })}
                />
              </div>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={c.forAll}
                onChange={(e) => update(c.key, { forAll: e.target.checked })}
                className="h-4 w-4 accent-brand-primary"
              />
              Platí pre obe prevádzky
            </label>
          </div>
        ))}
      </div>
    </div>
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
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
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
        className={cn(
          "max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 dark:bg-[#1b1b1b] sm:rounded-3xl",
          wide ? "max-w-3xl" : "max-w-lg"
        )}
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
        onFocus={(e) => e.currentTarget.select()}
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
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-black/10 bg-neutral-100 px-3 py-2 text-sm outline-none focus:border-brand-primary dark:border-white/10 dark:bg-[#222]"
      />
    </div>
  );
}
