"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useApp } from "@/lib/store";
import { RESTAURANTS, COUPONS } from "@/lib/data";
import { computeTotals } from "@/lib/pricing";
import { createOrder } from "@/lib/server-actions";
import { eur, shortId, cn, estimatedWait } from "@/lib/utils";
import {
  AddressVerification,
  type VerifyResult,
} from "@/components/AddressVerification";
import type { FulfillmentType, Order } from "@/lib/types";
import {
  Truck,
  Store,
  Wallet,
  CreditCard,
  Banknote,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

const PAYMENTS = {
  delivery: [
    { id: "cash_delivery", label: "Hotovosť pri doručení", icon: <Banknote className="h-5 w-5" /> },
  ],
  pickup: [
    { id: "cash_pickup", label: "Hotovosť pri odbere", icon: <Wallet className="h-5 w-5" /> },
    { id: "card_pickup", label: "Karta pri odbere", icon: <CreditCard className="h-5 w-5" /> },
  ],
};

export default function CheckoutPage() {
  const router = useRouter();
  const cart = useApp((s) => s.cart);
  const restaurantId = useApp((s) => s.restaurantId);
  const coupon = useApp((s) => s.coupon);
  const addOrder = useApp((s) => s.addOrder);
  const clearCart = useApp((s) => s.clearCart);
  const soldOut = useApp((s) => (restaurantId ? s.soldOut[restaurantId] ?? false : false));
  const queue = useApp((s) => (restaurantId ? s.kitchenQueue[restaurantId] ?? 0 : 0));
  const dbCoupons = useApp((s) => s.dbCoupons);
  const dbZones = useApp((s) => s.dbZones);

  const r = RESTAURANTS.find((x) => x.id === restaurantId);
  const [fulfillment, setFulfillment] = useState<FulfillmentType>("delivery");
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [payment, setPayment] = useState("cash_delivery");
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState("");

  if (!r) return null;

  const zone = fulfillment === "delivery" ? verify?.zone ?? null : null;
  const totals = computeTotals(
    cart,
    restaurantId,
    zone,
    fulfillment,
    coupon,
    dbCoupons ?? COUPONS
  );

  // No minimum order — delivery only needs a valid (in-range) address.
  const deliveryOk = fulfillment === "pickup" || verify?.zone != null;
  const detailsOk = name.trim() && phone.trim();
  const canOrder = cart.length > 0 && deliveryOk && detailsOk && !soldOut;

  const eta =
    fulfillment === "delivery"
      ? Math.max(zone?.estimatedMinutes ?? 45, estimatedWait(r.prepTimeMinutes, queue))
      : estimatedWait(r.prepTimeMinutes, queue);

  async function placeOrder() {
    if (!canOrder || !r || submitting) return;
    setSubmitting(true);
    setOrderError("");
    const paymentLabel =
      PAYMENTS[fulfillment].find((p) => p.id === payment)?.label ?? payment;
    const address = fulfillment === "delivery" ? verify?.address : undefined;

    // Server recomputes and validates all prices — the client total is only
    // for display and is never trusted server-side.
    const res = await createOrder({
      restaurantId: r.id,
      fulfillment,
      customerName: name,
      phone,
      email,
      address,
      lines: cart,
      couponCode: coupon,
      note,
    });

    if (!res.ok) {
      setOrderError(res.error ?? "Objednávku sa nepodarilo odoslať.");
      setSubmitting(false);
      return;
    }

    const order: Order = {
      id: res.id ?? shortId(),
      restaurantId: r.id,
      createdAt: Date.now(),
      status: "received",
      fulfillment,
      customerName: name,
      phone,
      email,
      address,
      zoneName: zone?.name,
      lines: cart,
      subtotal: totals.subtotal,
      deliveryFee: totals.deliveryFee,
      discount: totals.discount,
      total: res.total ?? totals.total,
      payment: paymentLabel,
      note,
      eta: res.eta ?? eta,
    };
    addOrder(order);
    clearCart();
    router.push(`/track?id=${order.id}`);
  }

  if (cart.length === 0) {
    return (
      <main className="section flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
        <div className="text-6xl">🛒</div>
        <h1 className="font-display text-2xl font-bold">Košík je prázdny</h1>
        <Link href="/menu" className="btn-primary">
          Prejsť do menu
        </Link>
      </main>
    );
  }

  return (
    <main className="section py-10">
      <h1 className="font-heading text-4xl uppercase tracking-tight sm:text-5xl">
        Pokladňa
      </h1>
      <p className="mt-1 text-neutral-500">
        {r.name} · {r.city}
      </p>

      {soldOut && (
        <div className="mt-6 rounded-2xl border border-brand-error/30 bg-brand-error/10 px-5 py-4 text-sm font-semibold text-[#ff8f8f]">
          Momentálne máme vypredané — objednávky sú dočasne pozastavené.
          Ďakujeme za pochopenie.
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {/* fulfillment */}
          <Panel title="Spôsob doručenia">
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { id: "delivery", label: "Rozvoz", icon: <Truck className="h-5 w-5" /> },
                  { id: "pickup", label: "Osobný odber", icon: <Store className="h-5 w-5" /> },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setFulfillment(opt.id);
                    setPayment(PAYMENTS[opt.id][0].id);
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border-2 p-4 transition-all",
                    fulfillment === opt.id
                      ? "border-brand-primary bg-brand-primary/5"
                      : "border-transparent bg-white dark:bg-[#242424]"
                  )}
                >
                  <span className="text-brand-primary">{opt.icon}</span>
                  <span className="font-semibold">{opt.label}</span>
                </button>
              ))}
            </div>
          </Panel>

          {/* address / pickup info */}
          {fulfillment === "delivery" ? (
            <Panel title="Adresa doručenia">
              <AddressVerification
                restaurant={r}
                zones={dbZones?.[r.id]}
                onResult={setVerify}
              />
            </Panel>
          ) : (
            <Panel title="Osobný odber">
              <div className="flex items-start gap-3 rounded-2xl bg-brand-secondary/10 p-4 text-sm">
                <Store className="mt-0.5 h-5 w-5 text-brand-secondary" />
                <div>
                  <p className="font-semibold">{r.address}</p>
                  <p className="text-neutral-500">
                    Bez poplatku za dopravu. Príprava ~{r.prepTimeMinutes} min.
                  </p>
                </div>
              </div>
            </Panel>
          )}

          {/* customer */}
          <Panel title="Vaše údaje">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Meno a priezvisko *"
                value={name}
                onChange={setName}
                span
              />
              <Input label="Telefón *" value={phone} onChange={setPhone} />
              <Input label="Email" value={email} onChange={setEmail} />
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-semibold text-neutral-500">
                  Poznámka k objednávke
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-black/10 bg-white p-3 text-sm outline-none focus:border-brand-primary dark:border-white/10 dark:bg-[#242424]"
                />
              </div>
            </div>
          </Panel>

          {/* payment */}
          <Panel title="Platba">
            <p className="mb-3 text-xs text-neutral-400">
              Online platby nie sú dostupné. Platíte pri odbere/doručení.
            </p>
            <div className="grid gap-2">
              {PAYMENTS[fulfillment].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPayment(p.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border-2 p-4 transition-all",
                    payment === p.id
                      ? "border-brand-primary bg-brand-primary/5"
                      : "border-transparent bg-white dark:bg-[#242424]"
                  )}
                >
                  <span className="text-brand-primary">{p.icon}</span>
                  <span className="font-semibold">{p.label}</span>
                  {payment === p.id && (
                    <CheckCircle2 className="ml-auto h-5 w-5 text-brand-primary" />
                  )}
                </button>
              ))}
            </div>
          </Panel>
        </div>

        {/* summary */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <h3 className="font-display text-lg font-bold">Súhrn objednávky</h3>
            <div className="mt-4 max-h-56 space-y-2 overflow-y-auto text-sm">
              {cart.map((l) => (
                <div key={l.lineId} className="flex justify-between gap-2">
                  <span className="text-neutral-600 dark:text-neutral-300">
                    {l.quantity}× {l.name}{" "}
                    <span className="text-neutral-400">({l.sizeLabel})</span>
                  </span>
                  <span className="font-medium">
                    {eur(l.unitPrice * l.quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1.5 border-t border-dashed border-black/10 pt-4 text-sm dark:border-white/10">
              <Row label="Medzisúčet" value={eur(totals.subtotal)} />
              <Row
                label={
                  fulfillment === "delivery" ? "Doprava" : "Osobný odber"
                }
                value={
                  fulfillment === "pickup"
                    ? "Zdarma"
                    : totals.deliveryFee === 0
                    ? verify?.zone
                      ? "Zdarma"
                      : "—"
                    : eur(totals.deliveryFee)
                }
              />
              {totals.discount > 0 && (
                <Row
                  label="Zľava"
                  value={`-${eur(totals.discount)}`}
                  success
                />
              )}
              <div className="flex justify-between border-t border-black/10 pt-2 font-display text-lg font-extrabold dark:border-white/10">
                <span>Spolu</span>
                <span className="text-brand-primary">{eur(totals.total)}</span>
              </div>
              <p className="text-xs text-neutral-400">
                Ceny sú vrátane DPH · odhad doručenia ~{eta} min
              </p>
            </div>

            {!detailsOk && (
              <p className="mt-3 text-xs text-brand-error">
                Vyplňte meno a telefón.
              </p>
            )}
            {fulfillment === "delivery" && !deliveryOk && (
              <p className="mt-3 text-xs text-brand-error">
                Zadajte a overte adresu doručenia.
              </p>
            )}

            {orderError && (
              <p className="mt-3 text-xs text-brand-error">{orderError}</p>
            )}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={placeOrder}
              disabled={!canOrder || submitting}
              className="btn-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Odosielam…" : "Záväzne objednať"}
              {!submitting && <ArrowRight className="h-5 w-5" />}
            </motion.button>
          </div>
        </div>
      </div>
    </main>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-6">
      <h2 className="mb-4 font-display text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  span,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  span?: boolean;
}) {
  return (
    <div className={span ? "col-span-2" : ""}>
      <label className="mb-1 block text-xs font-semibold text-neutral-500">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-primary dark:border-white/10 dark:bg-[#242424]"
      />
    </div>
  );
}

function Row({
  label,
  value,
  success,
}: {
  label: string;
  value: string;
  success?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-neutral-500">{label}</span>
      <span className={success ? "text-brand-success" : ""}>{value}</span>
    </div>
  );
}
