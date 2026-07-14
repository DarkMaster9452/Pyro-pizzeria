"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useApp } from "@/lib/store";
import { RESTAURANTS } from "@/lib/data";
import { eur, formatAddress } from "@/lib/utils";
import {
  cancelOrder,
  getOrderStatus,
  type PublicOrderStatus,
} from "@/lib/server-actions";
import type { OrderStatus } from "@/lib/types";
import {
  Check,
  Clock,
  ChefHat,
  Package,
  Truck,
  Home,
  CheckCheck,
  X,
  Loader2,
} from "lucide-react";

const STEPS: { id: OrderStatus; label: string; icon: React.ReactNode }[] = [
  { id: "received", label: "Prijaté", icon: <Clock className="h-5 w-5" /> },
  { id: "accepted", label: "Potvrdené", icon: <Check className="h-5 w-5" /> },
  { id: "preparing", label: "Pripravuje sa", icon: <ChefHat className="h-5 w-5" /> },
  { id: "ready", label: "Pripravené", icon: <Package className="h-5 w-5" /> },
  { id: "delivering", label: "Na ceste", icon: <Truck className="h-5 w-5" /> },
  { id: "delivered", label: "Doručené", icon: <Home className="h-5 w-5" /> },
];

function TrackInner() {
  const params = useSearchParams();
  const id = params.get("id");
  const orders = useApp((s) => s.orders);
  const updateOrderStatus = useApp((s) => s.updateOrderStatus);
  const order = orders.find((o) => o.id === id) ?? orders[0];

  // Live status from the database (authoritative — reflects the kitchen and the
  // courier). Falls back to the local simulation if the DB is unreachable.
  const [db, setDb] = useState<PublicOrderStatus | null>(null);
  useEffect(() => {
    if (!order) return;
    let active = true;
    const poll = () =>
      getOrderStatus(order.id, order.cancelToken)
        .then((s) => active && setDb(s))
        .catch(() => {});
    poll();
    const t = setInterval(poll, 5000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [order?.id]);

  // ---- Customer cancellation (only before the kitchen starts preparing) ----
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelErr, setCancelErr] = useState<string | null>(null);

  async function handleCancel() {
    if (!order) return;
    setCancelling(true);
    setCancelErr(null);
    const res = await cancelOrder(order.id, order.cancelToken).catch(() => ({
      ok: false,
      error: "Zrušenie sa nepodarilo. Skúste znova.",
    }));
    setCancelling(false);
    if (res.ok) {
      updateOrderStatus(order.id, "cancelled");
      setDb((prev) => (prev ? { ...prev, status: "cancelled" } : prev));
      setConfirmCancel(false);
    } else {
      setCancelErr(res.error ?? "Zrušenie sa nepodarilo.");
    }
  }

  // Local simulation — only runs while the DB has no record (e.g. demo mode).
  useEffect(() => {
    if (!order || db) return;
    const seq: OrderStatus[] =
      order.fulfillment === "delivery"
        ? ["received", "accepted", "preparing", "ready", "delivering", "delivered"]
        : ["received", "accepted", "preparing", "ready", "delivered"];
    const idx = seq.indexOf(order.status);
    if (idx < 0 || idx >= seq.length - 1) return;
    const t = setTimeout(() => {
      updateOrderStatus(order.id, seq[idx + 1]);
    }, 6000);
    return () => clearTimeout(t);
  }, [order, updateOrderStatus, db]);

  // Drop the order from tracking 5 minutes after it was paid/settled.
  // An order drops off tracking once it's no longer relevant:
  //  • 5 min after it was paid/settled, or
  //  • 30 min after it was delivered/cancelled (even if never marked paid), or
  //  • 6 h after it was placed (safety net for stale/abandoned orders).
  const effStatus = db?.status ?? order?.status ?? "received";
  const ageMs = order ? Date.now() - order.createdAt : 0;
  const expired =
    !!order &&
    (((db?.paid ?? false) &&
      db?.paidAgoSec != null &&
      db.paidAgoSec > 5 * 60) ||
      ((effStatus === "delivered" || effStatus === "cancelled") &&
        ageMs > 30 * 60 * 1000) ||
      ageMs > 6 * 60 * 60 * 1000);

  if (!order || expired) {
    return (
      <main className="section flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
        <div className="text-6xl">📦</div>
        <h1 className="font-display text-2xl font-bold">
          Žiadna objednávka na sledovanie
        </h1>
        <p className="text-neutral-500">Vytvorte objednávku v menu.</p>
        <Link href="/menu" className="btn-primary">
          Prejsť do menu
        </Link>
      </main>
    );
  }

  const r = RESTAURANTS.find((x) => x.id === order.restaurantId);
  const status = db?.status ?? order.status;
  const paid = db?.paid ?? false;
  const cancelled = status === "cancelled";
  // The customer may cancel only until the kitchen starts preparing the order.
  const canCancel =
    !cancelled && !paid && (status === "received" || status === "accepted");
  const steps = STEPS.filter(
    (s) => order.fulfillment === "delivery" || s.id !== "delivering"
  );
  const currentIdx = steps.findIndex((s) => s.id === status);

  return (
    <main className="section py-10">
      <div className="mx-auto max-w-2xl">
        <div className="card overflow-hidden">
          <div className="bg-gradient-to-br from-brand-primary to-brand-secondary p-6 text-white">
            <p className="text-sm text-white/80">Objednávka</p>
            <h1 className="font-display text-3xl font-extrabold">#{order.id}</h1>
            <p className="mt-1 text-white/85">
              {r?.name} · {order.fulfillment === "delivery" ? "Rozvoz" : "Odber"}{" "}
              · odhad ~{order.eta} min
            </p>
          </div>

          {paid && !cancelled && (
            <div className="flex items-center gap-3 border-b border-black/5 bg-brand-success/10 px-6 py-4 text-brand-success dark:border-white/10">
              <CheckCheck className="h-6 w-6 shrink-0" />
              <div>
                <p className="font-display font-bold">
                  Objednávka je zaplatená a vybavená
                </p>
                <p className="text-sm text-brand-success/80">
                  Ďakujeme! Uvidíme sa nabudúce. 🔥
                </p>
              </div>
            </div>
          )}

          {cancelled && (
            <div className="flex items-center gap-3 border-b border-black/5 bg-red-500/10 px-6 py-4 text-red-600 dark:border-white/10 dark:text-red-400">
              <X className="h-6 w-6 shrink-0" />
              <div>
                <p className="font-display font-bold">Objednávka bola zrušená</p>
                <p className="text-sm text-red-600/80 dark:text-red-400/80">
                  Ak to bol omyl, jednoducho objednajte znova.
                </p>
              </div>
            </div>
          )}

          {/* stepper */}
          {!cancelled && (
          <div className="p-6">
            <div className="space-y-1">
              {steps.map((s, i) => {
                // A delivered order is finished — mark the last step done, not
                // perpetually "in progress".
                const finished = status === "delivered";
                const done = i < currentIdx || (finished && i <= currentIdx);
                const active = i === currentIdx && !finished;
                return (
                  <div key={s.id} className="flex items-center gap-4">
                    <div className="flex flex-col items-center">
                      <motion.div
                        animate={
                          active
                            ? { scale: [1, 1.12, 1] }
                            : { scale: 1 }
                        }
                        transition={{
                          repeat: active ? Infinity : 0,
                          duration: 1.6,
                        }}
                        className={`flex h-11 w-11 items-center justify-center rounded-full ${
                          done || active
                            ? "bg-brand-primary text-white"
                            : "bg-neutral-200 text-neutral-400 dark:bg-neutral-700"
                        }`}
                      >
                        {done ? <Check className="h-5 w-5" /> : s.icon}
                      </motion.div>
                      {i < steps.length - 1 && (
                        <div
                          className={`h-8 w-0.5 ${
                            done ? "bg-brand-primary" : "bg-neutral-200 dark:bg-neutral-700"
                          }`}
                        />
                      )}
                    </div>
                    <div className="pb-6">
                      <p
                        className={`font-semibold ${
                          active ? "text-brand-primary" : ""
                        }`}
                      >
                        {s.label}
                      </p>
                      {active && (
                        <p className="text-sm text-neutral-500">
                          Prebieha… aktualizuje sa automaticky
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          )}

          {/* summary */}
          <div className="border-t border-black/5 p-6 dark:border-white/10">
            <h3 className="mb-3 font-display font-bold">Položky</h3>
            <div className="space-y-1.5 text-sm">
              {order.lines.map((l) => (
                <div key={l.lineId} className="flex justify-between">
                  <span className="text-neutral-600 dark:text-neutral-300">
                    {l.quantity}× {l.name}
                  </span>
                  <span>{eur(l.unitPrice * l.quantity)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-dashed border-black/10 pt-2 font-bold dark:border-white/10">
                <span>Spolu</span>
                <span className="text-brand-primary">{eur(order.total)}</span>
              </div>
            </div>
            {order.address && (
              <p className="mt-4 text-sm text-neutral-500">
                Doručenie: {formatAddress(order.address)}
              </p>
            )}
            <p className="mt-1 text-sm text-neutral-500">
              Platba: {order.payment}
            </p>

            {canCancel && (
              <div className="mt-5 border-t border-black/5 pt-5 dark:border-white/10">
                {!confirmCancel ? (
                  <>
                    <button
                      onClick={() => {
                        setCancelErr(null);
                        setConfirmCancel(true);
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
                    >
                      <X className="h-4 w-4" />
                      Zrušiť objednávku
                    </button>
                    <p className="mt-2 text-xs text-neutral-500">
                      Zrušiť môžete, kým sa objednávka nezačne pripravovať.
                    </p>
                  </>
                ) : (
                  <div>
                    <p className="text-sm font-semibold">
                      Naozaj chcete zrušiť túto objednávku?
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={handleCancel}
                        disabled={cancelling}
                        className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                      >
                        {cancelling ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                        Áno, zrušiť
                      </button>
                      <button
                        onClick={() => setConfirmCancel(false)}
                        disabled={cancelling}
                        className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-neutral-600 transition hover:bg-black/5 disabled:opacity-60 dark:border-white/15 dark:text-neutral-300 dark:hover:bg-white/5"
                      >
                        Ponechať
                      </button>
                    </div>
                  </div>
                )}
                {cancelErr && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                    {cancelErr}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <Link href="/menu" className="btn-ghost">
            Objednať znova
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={<div className="section py-20">Načítavam…</div>}>
      <TrackInner />
    </Suspense>
  );
}
