"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useApp, type CheckoutDraft } from "@/lib/store";
import { RESTAURANTS, COUPONS } from "@/lib/data";
import { computeTotals } from "@/lib/pricing";
import {
  createOrder,
  getCustomerProfile,
  saveCustomerProfile,
} from "@/lib/server-actions";
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
  Clock,
} from "lucide-react";

const PAYMENTS = {
  delivery: [
    { id: "cash_delivery", label: "Hotovosť pri doručení", icon: <Banknote className="h-5 w-5" /> },
    { id: "card_delivery", label: "Karta pri doručení", icon: <CreditCard className="h-5 w-5" /> },
  ],
  pickup: [
    { id: "cash_pickup", label: "Hotovosť pri odbere", icon: <Wallet className="h-5 w-5" /> },
    { id: "card_pickup", label: "Karta pri odbere", icon: <CreditCard className="h-5 w-5" /> },
  ],
} as const;

type PaymentId =
  | "cash_delivery"
  | "card_delivery"
  | "cash_pickup"
  | "card_pickup";

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
  const dbOpen = useApp((s) => s.dbOpen);
  // Draft is kept in localStorage so details survive edits until an order is
  // placed (see store). Cleared on success.
  const draft = useApp((s) => s.checkoutDraft);
  const setDraft = useApp((s) => s.setCheckoutDraft);
  const clearDraft = useApp((s) => s.clearCheckoutDraft);

  const notOpen = restaurantId ? dbOpen?.[restaurantId] === false : false;

  const r = RESTAURANTS.find((x) => x.id === restaurantId);
  const [fulfillment, setFulfillment] = useState<FulfillmentType>("delivery");
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [payment, setPayment] = useState<PaymentId>("cash_delivery");
  const [schedule, setSchedule] = useState<"asap" | "time">("asap");
  const [scheduleTime, setScheduleTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [saveProfile, setSaveProfile] = useState(true);

  // If a customer is signed in on this device, pull their saved details in to
  // pre-fill checkout (only fills blanks — never overwrites in-progress edits).
  useEffect(() => {
    let active = true;
    getCustomerProfile()
      .then((p) => {
        if (!active || !p.loggedIn) return;
        setLoggedIn(true);
        const cur = useApp.getState().checkoutDraft;
        const patch: Partial<CheckoutDraft> = {};
        if (!cur.name && p.name) patch.name = p.name;
        if (!cur.phone && p.phone) patch.phone = p.phone;
        if (!cur.email && p.email) patch.email = p.email;
        if (p.address) {
          if (!cur.street && p.address.street) patch.street = p.address.street;
          if (!cur.houseNumber && p.address.houseNumber)
            patch.houseNumber = p.address.houseNumber;
          if (!cur.city && p.address.city) patch.city = p.address.city;
          if (!cur.zip && p.address.zip) patch.zip = p.address.zip;
        }
        if (Object.keys(patch).length) setDraft(patch);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [setDraft]);

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

  const minOrder = zone?.minimumOrder ?? 0;
  const meetsMinimum = totals.subtotal >= minOrder;
  const missingForMinimum = Math.max(0, minOrder - totals.subtotal);
  const deliveryOk =
    fulfillment === "pickup" || (verify?.zone != null && meetsMinimum);
  const detailsOk = draft.name.trim() && draft.phone.trim();
  const scheduleOk = schedule === "asap" || scheduleTime !== "";
  const canOrder =
    cart.length > 0 &&
    deliveryOk &&
    detailsOk &&
    scheduleOk &&
    !soldOut &&
    !notOpen;

  const eta =
    fulfillment === "delivery"
      ? Math.max(zone?.estimatedMinutes ?? 45, estimatedWait(r.prepTimeMinutes, queue))
      : estimatedWait(r.prepTimeMinutes, queue);

  function buildNote(): string {
    const sched =
      schedule === "time" && scheduleTime
        ? `Objednávka na čas ${scheduleTime}. `
        : "";
    return (sched + (draft.note ?? "")).trim();
  }

  async function placeOrder() {
    if (!canOrder || !r || submitting) return;
    setSubmitting(true);
    setOrderError("");
    const paymentLabel =
      PAYMENTS[fulfillment].find((p) => p.id === payment)?.label ?? payment;
    const address = fulfillment === "delivery" ? verify?.address : undefined;
    const note = buildNote();

    const res = await createOrder({
      restaurantId: r.id,
      fulfillment,
      customerName: draft.name,
      phone: draft.phone,
      email: draft.email,
      address,
      lines: cart,
      couponCode: coupon,
      note,
      payment,
    });

    if (!res.ok) {
      setOrderError(res.error ?? "Objednávku sa nepodarilo odoslať.");
      setSubmitting(false);
      return;
    }

    // Signed-in customer chose to remember details → persist to their account.
    if (loggedIn && saveProfile) {
      const profileAddress =
        draft.street || draft.city
          ? {
              street: draft.street,
              houseNumber: draft.houseNumber,
              city: draft.city,
              zip: draft.zip,
            }
          : undefined;
      await saveCustomerProfile({
        name: draft.name,
        phone: draft.phone,
        address: profileAddress,
      }).catch(() => {});
    }

    const order: Order = {
      id: res.id ?? shortId(),
      restaurantId: r.id,
      createdAt: Date.now(),
      status: "received",
      fulfillment,
      customerName: draft.name,
      phone: draft.phone,
      email: draft.email,
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
    clearDraft(); // details are only cleared once the order is paid/placed
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
    <main className="section py-10 pb-32 lg:pb-10">
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

      {notOpen && !soldOut && (
        <div className="mt-6 rounded-2xl border border-brand-error/30 bg-brand-error/10 px-5 py-4 text-sm font-semibold text-[#ff8f8f]">
          Prevádzka dnes ešte nie je otvorená. Objednávky spustíme, keď otvoríme.
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
                initialAddress={{
                  street: draft.street,
                  houseNumber: draft.houseNumber,
                  city: draft.city,
                  zip: draft.zip,
                }}
                onAddressChange={(a) =>
                  setDraft({
                    street: a.street,
                    houseNumber: a.houseNumber,
                    city: a.city,
                    zip: a.zip,
                  })
                }
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

          {/* when */}
          <Panel title="Kedy">
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { id: "asap", label: "Čo najskôr" },
                  { id: "time", label: "Na konkrétny čas" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSchedule(opt.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-2xl border-2 p-4 text-sm font-semibold transition-all",
                    schedule === opt.id
                      ? "border-brand-primary bg-brand-primary/5"
                      : "border-transparent bg-white dark:bg-[#242424]"
                  )}
                >
                  <Clock className="h-5 w-5 text-brand-primary" />
                  {opt.label}
                </button>
              ))}
            </div>
            {schedule === "time" && (
              <div className="mt-3">
                <label className="mb-1 block text-xs font-semibold text-neutral-500">
                  Čas doručenia / odberu *
                </label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-primary dark:border-white/10 dark:bg-[#242424]"
                />
                <p className="mt-1 text-xs text-neutral-400">
                  Objednávku pripravíme na zvolený čas.
                </p>
              </div>
            )}
          </Panel>

          {/* customer */}
          <Panel title="Vaše údaje">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Meno a priezvisko *"
                value={draft.name}
                onChange={(v) => setDraft({ name: v })}
                autoComplete="name"
                span
              />
              <Input
                label="Telefón *"
                value={draft.phone}
                onChange={(v) => setDraft({ phone: v.replace(/[^\d+ ]/g, "") })}
                autoComplete="tel"
                inputMode="tel"
              />
              <Input
                label="Email"
                value={draft.email}
                onChange={(v) => setDraft({ email: v })}
                autoComplete="email"
                inputMode="email"
              />
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-semibold text-neutral-500">
                  Poznámka k objednávke
                </label>
                <textarea
                  value={draft.note}
                  onChange={(e) => setDraft({ note: e.target.value })}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-black/10 bg-white p-3 text-sm outline-none focus:border-brand-primary dark:border-white/10 dark:bg-[#242424]"
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-neutral-400">
              Údaje zostanú uložené vo vašom zariadení, kým neobjednáte.
            </p>
          </Panel>

          {/* payment */}
          <Panel title="Platba">
            <p className="mb-3 text-xs text-neutral-400">
              Online platby nie sú dostupné. Platíte pri odbere/doručení —
              hotovosťou alebo kartou.
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

            {loggedIn && (
              <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl bg-black/[0.03] p-4 text-sm dark:bg-white/5">
                <input
                  type="checkbox"
                  checked={saveProfile}
                  onChange={(e) => setSaveProfile(e.target.checked)}
                  className="h-5 w-5 shrink-0 accent-brand-primary"
                />
                <span>
                  <span className="font-semibold">
                    Uložiť údaje pre ďalšie objednávky
                  </span>
                  <span className="block text-xs text-neutral-500">
                    Meno, telefón a adresa sa uložia k vášmu účtu.
                  </span>
                </span>
              </label>
            )}
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
                Ceny sú vrátane DPH ·{" "}
                {schedule === "time" && scheduleTime
                  ? `na ${scheduleTime}`
                  : `odhad ~${eta} min`}
              </p>
            </div>

            {!detailsOk && (
              <p className="mt-3 text-xs text-brand-error">
                Vyplňte meno a telefón.
              </p>
            )}
            {fulfillment === "delivery" && verify?.zone == null && (
              <p className="mt-3 text-xs text-brand-error">
                Zadajte a overte adresu doručenia (ulica, číslo domu, mesto).
              </p>
            )}
            {fulfillment === "delivery" &&
              verify?.zone != null &&
              !meetsMinimum && (
                <p className="mt-3 text-xs text-brand-error">
                  Minimálna objednávka pre zónu {zone?.name} je {eur(minOrder)}.
                  Pridajte ešte {eur(missingForMinimum)}.
                </p>
              )}
            {schedule === "time" && !scheduleTime && (
              <p className="mt-3 text-xs text-brand-error">
                Zvoľte čas objednávky.
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
  autoComplete,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  span?: boolean;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "tel" | "email";
}) {
  return (
    <div className={span ? "col-span-2" : ""}>
      <label className="mb-1 block text-xs font-semibold text-neutral-500">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        inputMode={inputMode}
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
