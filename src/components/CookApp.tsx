"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getKitchenBoard,
  advanceKitchenOrder,
  returnKitchenOrder,
  setOrderSurcharge,
  type KitchenOrder,
} from "@/lib/server-actions";
import { eur, POL_POL_SURCHARGE } from "@/lib/utils";
import { NoShift } from "@/components/DriverApp";
import { StaffPasswordBanner } from "@/components/StaffSecurity";
import { LogoutButton } from "@/components/LogoutButton";
import {
  ChefHat,
  Clock,
  Truck,
  Store,
  RefreshCw,
  Check,
  RotateCcw,
  ChevronRight,
  StickyNote,
  Pizza,
} from "lucide-react";

// The cook's board. Cooks only move orders through prep — they can never take
// payment or hand an order over. A finished ("ready") order stays visible until
// a driver or the counter takes it, and can be pulled back into prep by mistake
// recovery (with a confirmation).
export function CookApp({
  name,
  restaurantName,
  onShift,
}: {
  name: string;
  restaurantName: string;
  onShift: boolean;
}) {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmReturn, setConfirmReturn] = useState<string | null>(null);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(() => {
    getKitchenBoard()
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

  async function advance(id: string) {
    setBusyId(id);
    setError("");
    try {
      const res = await advanceKitchenOrder(id);
      if (!res.ok) setError(res.error ?? "Akcia zlyhala.");
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function takeBack(id: string) {
    setBusyId(id);
    setError("");
    try {
      const res = await returnKitchenOrder(id);
      if (!res.ok) setError(res.error ?? "Nedá sa vrátiť.");
      setConfirmReturn(null);
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function toggleSurcharge(id: string, on: boolean) {
    setBusyId(id);
    setError("");
    try {
      const res = await setOrderSurcharge(id, on);
      if (!res.ok) setError(res.error ?? "Akcia zlyhala.");
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  const nove = orders.filter((o) =>
    ["received", "accepted"].includes(o.status)
  );
  const prava = orders.filter((o) => o.status === "preparing");
  const hotove = orders.filter((o) => o.status === "ready");

  if (!onShift) {
    return <NoShift name={name} restaurantName={restaurantName} />;
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-accent/15 text-brand-accent">
              <ChefHat className="h-5 w-5" />
            </span>
            <div>
              <p className="font-heading text-lg uppercase leading-none tracking-tight">
                Kuchyňa
              </p>
              <p className="text-xs text-white/45">
                {restaurantName} · {name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="rounded-full border border-white/10 p-2 text-white/60 transition-colors hover:bg-white/5"
              aria-label="Obnoviť"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <LogoutButton className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 transition-colors hover:bg-white/5" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6">
        <StaffPasswordBanner />
        {error && (
          <div className="mb-4 rounded-2xl border border-brand-error/30 bg-brand-error/10 px-4 py-3 text-sm text-[#ff9d9d]">
            {error}
          </div>
        )}

        {!loaded ? (
          <p className="py-20 text-center text-white/40">Načítavam…</p>
        ) : orders.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center text-white/40">
            <ChefHat className="mx-auto mb-3 h-10 w-10 opacity-40" />
            Žiadne objednávky v kuchyni.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3 md:gap-6">
            <Column title="Nové" hint="Začnite s prípravou." count={nove.length}>
              {nove.map((o) => (
                <OrderCard
                  key={o.id}
                  o={o}
                  busy={busyId === o.id}
                  confirmReturn={confirmReturn === o.id}
                  onAdvance={() => advance(o.id)}
                  onAskReturn={() => setConfirmReturn(o.id)}
                  onCancelReturn={() => setConfirmReturn(null)}
                  onConfirmReturn={() => takeBack(o.id)}
                  onToggleSurcharge={(on) => toggleSurcharge(o.id, on)}
                />
              ))}
            </Column>
            <Column
              title="Pripravuje sa"
              hint="Rozrobené objednávky."
              count={prava.length}
            >
              {prava.map((o) => (
                <OrderCard
                  key={o.id}
                  o={o}
                  busy={busyId === o.id}
                  confirmReturn={confirmReturn === o.id}
                  onAdvance={() => advance(o.id)}
                  onAskReturn={() => setConfirmReturn(o.id)}
                  onCancelReturn={() => setConfirmReturn(null)}
                  onConfirmReturn={() => takeBack(o.id)}
                  onToggleSurcharge={(on) => toggleSurcharge(o.id, on)}
                />
              ))}
            </Column>
            <Column
              title="Hotové — čaká na prevzatie"
              hint="Preberá rozvoz alebo výdaj."
              count={hotove.length}
            >
              {hotove.map((o) => (
                <OrderCard
                  key={o.id}
                  o={o}
                  busy={busyId === o.id}
                  confirmReturn={confirmReturn === o.id}
                  onAdvance={() => advance(o.id)}
                  onAskReturn={() => setConfirmReturn(o.id)}
                  onCancelReturn={() => setConfirmReturn(null)}
                  onConfirmReturn={() => takeBack(o.id)}
                  onToggleSurcharge={(on) => toggleSurcharge(o.id, on)}
                />
              ))}
            </Column>
          </div>
        )}
      </div>
    </main>
  );
}

function Column({
  title,
  hint,
  count,
  children,
}: {
  title: string;
  hint: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="font-heading text-sm uppercase tracking-[0.15em] text-white/70">
          {title}{" "}
          <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">
            {count}
          </span>
        </h2>
        <p className="text-xs text-white/30">{hint}</p>
      </div>
      <div className="space-y-3">
        {count === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 py-8 text-center text-xs text-white/25">
            Prázdne
          </p>
        ) : (
          <AnimatePresence initial={false}>{children}</AnimatePresence>
        )}
      </div>
    </section>
  );
}

function OrderCard({
  o,
  busy,
  confirmReturn,
  onAdvance,
  onAskReturn,
  onCancelReturn,
  onConfirmReturn,
  onToggleSurcharge,
}: {
  o: KitchenOrder;
  busy: boolean;
  confirmReturn: boolean;
  onAdvance: () => void;
  onAskReturn: () => void;
  onCancelReturn: () => void;
  onConfirmReturn: () => void;
  onToggleSurcharge: (on: boolean) => void;
}) {
  const isDelivery = o.fulfillment === "delivery";
  const advanceLabel =
    o.status === "preparing" ? "Označiť hotové" : "Začať prípravu";
  const hasSurcharge = o.surcharge > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-heading text-lg font-extrabold">#{o.id}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/70">
              {isDelivery ? (
                <>
                  <Truck className="h-3 w-3" /> Rozvoz
                </>
              ) : (
                <>
                  <Store className="h-3 w-3" /> Odber
                </>
              )}
            </span>
          </div>
          <p className="mt-1 flex items-center gap-1 text-xs text-white/40">
            <Clock className="h-3 w-3" />
            <span className="font-semibold text-white/70">
              {new Date(o.createdAt).toLocaleTimeString("sk-SK", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>{" "}
            · pred {o.minsAgo} min · {o.customerName}
          </p>
        </div>
      </div>

      <ul className="mt-2 space-y-1 text-sm text-white/70">
        {o.lines.map((l, i) => (
          <li key={i}>
            {l.quantity}× {l.name}
            {l.polpol && (
              <span className="ml-1 font-semibold text-brand-primary">
                · 🍕 pol/pol
              </span>
            )}
            {l.note && (
              <span className="mt-0.5 block pl-4 text-xs font-semibold text-amber-300">
                → {l.note}
              </span>
            )}
          </li>
        ))}
      </ul>

      {o.note && (
        <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-300">
          <StickyNote className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{o.note}</span>
        </div>
      )}

      {/* Custom-request surcharge (half-and-half pizza). Only for unpaid orders
          that contain a real pizza; stays visible if already applied. */}
      {(o.pizzaCount > 0 || hasSurcharge) && (
      <button
        disabled={busy || o.paid}
        onClick={() => onToggleSurcharge(!hasSurcharge)}
        className={`mt-2 inline-flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
          hasSurcharge
            ? "border-brand-primary/50 bg-brand-primary/15 text-brand-primary"
            : "border-white/15 text-white/60 hover:bg-white/5"
        }`}
      >
        <span className="flex items-center gap-1.5">
          <Pizza className="h-4 w-4" /> Pol/pol pizza · príplatok{" "}
          {eur(POL_POL_SURCHARGE)}
        </span>
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full border ${
            hasSurcharge
              ? "border-brand-primary bg-brand-primary text-white"
              : "border-white/25"
          }`}
        >
          {hasSurcharge && <Check className="h-3.5 w-3.5" />}
        </span>
      </button>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {o.status !== "ready" ? (
          <button
            disabled={busy}
            onClick={onAdvance}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary px-4 py-2 text-xs font-bold text-white transition-colors hover:brightness-110 disabled:opacity-50"
          >
            {o.status === "preparing" ? (
              <Check className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            {advanceLabel}
          </button>
        ) : confirmReturn ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-white/70">
              Vrátiť späť do prípravy?
            </span>
            <button
              disabled={busy}
              onClick={onConfirmReturn}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-accent px-3 py-2 text-xs font-bold text-black transition-colors hover:brightness-110 disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" /> Áno, vrátiť
            </button>
            <button
              onClick={onCancelReturn}
              className="rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-white/70"
            >
              Zrušiť
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-success/20 px-3 py-2 text-xs font-semibold text-brand-success">
              <Check className="h-4 w-4" /> Hotové
            </span>
            <button
              onClick={onAskReturn}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-white/70 transition-colors hover:bg-white/5"
            >
              <RotateCcw className="h-4 w-4" /> Vrátiť do prípravy
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
