"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getDispatchBoard,
  claimDispatchOrder,
  releaseDispatchOrder,
  markDispatchDelivering,
  markDispatchPaid,
  getEditableOrder,
  type DispatchOrder,
  type EditableOrder,
} from "@/lib/server-actions";
import { StaffOrderForm } from "@/components/StaffOrderForm";
import { StaffPasswordBanner } from "@/components/StaffSecurity";
import { LogoutButton } from "@/components/LogoutButton";
import { eur, formatAddress } from "@/lib/utils";
import {
  Bike,
  Navigation,
  Phone,
  PhoneCall,
  Check,
  CheckCheck,
  CreditCard,
  Package,
  Truck,
  Store,
  MapPin,
  Clock,
  Home,
  LayoutDashboard,
  Hand,
  RotateCcw,
  RefreshCw,
  Pencil,
  Plus,
  X,
} from "lucide-react";

function navUrl(o: DispatchOrder): string | null {
  const q = formatAddress(o.address);
  if (!q) return null;
  return `https://mapy.cz/zakladni?q=${encodeURIComponent(q)}`;
}

function telUrl(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, "")}`;
}

export function DriverApp({
  role,
  name,
  restaurantId,
  restaurantName,
  restaurantAddress,
  userId,
  onShift,
}: {
  role: string;
  name: string;
  restaurantId: string;
  restaurantName: string;
  restaurantAddress: string;
  userId: string;
  onShift: boolean;
}) {
  const isAdmin = role === "admin" || role === "super_admin";

  if (!onShift) {
    return <NoShift name={name} restaurantName={restaurantName} />;
  }
  const [orders, setOrders] = useState<DispatchOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [editData, setEditData] = useState<EditableOrder | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(() => {
    getDispatchBoard()
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

  // Brand colours follow this account's restaurant (Pyro / Polomárik).
  useEffect(() => {
    document.documentElement.setAttribute("data-brand", restaurantId);
  }, [restaurantId]);

  async function run(
    id: string,
    fn: (id: string) => Promise<{ ok: boolean; error?: string }>
  ) {
    setBusyId(id);
    setError("");
    try {
      const res = await fn(id);
      if (!res.ok) setError(res.error ?? "Akcia zlyhala.");
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function openEdit(id: string) {
    setError("");
    setEditLoading(true);
    try {
      const data = await getEditableOrder(id);
      if (!data) setError("Objednávku sa nepodarilo načítať.");
      else setEditData(data);
    } finally {
      setEditLoading(false);
    }
  }

  const mine = orders.filter((o) => o.driverId === userId && !o.paid);
  const available = orders.filter((o) => !o.driverId && !o.paid);
  const others = orders.filter(
    (o) => o.driverId && o.driverId !== userId && !o.paid
  );
  const done = orders.filter((o) => o.paid);

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900 dark:bg-[#0a0a0a] dark:text-white">
      {/* header */}
      <header className="sticky top-0 z-20 border-b border-black/10 bg-neutral-100/90 backdrop-blur-md dark:border-white/10 dark:bg-[#0a0a0a]/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-primary/15 text-brand-primary">
              <Bike className="h-5 w-5" />
            </span>
            <div>
              <p className="font-heading text-lg uppercase leading-none tracking-tight">
                Rozvoz
              </p>
              <p className="text-xs text-neutral-500 dark:text-white/45">
                {restaurantName} · {name}
                {isAdmin && " · admin"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="rounded-full border border-black/10 dark:border-white/10 p-2 text-neutral-600 dark:text-white/60 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              aria-label="Obnoviť"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            {isAdmin && (
              <Link
                href="/admin"
                title="Späť do administrácie (bez odhlásenia)"
                className="flex items-center gap-1.5 rounded-full border border-brand-primary/40 bg-brand-primary/10 px-3 py-2 text-xs font-semibold text-brand-primary transition-colors hover:bg-brand-primary/20"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}
            <Link
              href="/"
              title="Späť na web (bez odhlásenia)"
              className="flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 px-3 py-2 text-xs font-semibold text-neutral-700 dark:text-white/70 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Web</span>
            </Link>
            <LogoutButton className="flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 px-3 py-2 text-xs font-semibold text-neutral-700 dark:text-white/70 transition-colors hover:bg-black/5 dark:hover:bg-white/5" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6">
        <StaffPasswordBanner />
        {error && (
          <div className="mb-4 rounded-2xl border border-brand-error/30 bg-brand-error/10 px-4 py-3 text-sm text-brand-error dark:text-[#ff9d9d]">
            {error}
          </div>
        )}

        {/* Admins can watch the delivery board but never manage it. */}
        {isAdmin && (
          <div className="mb-6 flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.02] px-4 py-3 text-sm text-neutral-600 dark:text-white/60">
            <Bike className="h-4 w-4 text-brand-primary" />
            Náhľad rozvozu — vidíte, v akom štádiu sú objednávky. Rozvoz
            spravujú kuriéri.
          </div>
        )}

        {/* phone-order entry — couriers only, admins are view-only */}
        {!isAdmin && (
        <div className="mb-6 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.02]">
          <button
            onClick={() => setShowNew((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="flex items-center gap-2 font-semibold">
              <PhoneCall className="h-4 w-4 text-brand-primary" /> Nová
              telefonická objednávka
            </span>
            {showNew ? (
              <X className="h-4 w-4 text-neutral-500 dark:text-white/50" />
            ) : (
              <Plus className="h-4 w-4 text-neutral-500 dark:text-white/50" />
            )}
          </button>
          <AnimatePresence>
            {showNew && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="border-t border-black/10 dark:border-white/10 p-4">
                  <StaffOrderForm
                    restaurantId={restaurantId}
                    onCreated={() => {
                      refresh();
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        )}

        {!loaded ? (
          <p className="py-20 text-center text-neutral-500 dark:text-white/40">Načítavam…</p>
        ) : orders.length === 0 ? (
          <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.02] py-20 text-center text-neutral-500 dark:text-white/40">
            <Package className="mx-auto mb-3 h-10 w-10 opacity-40" />
            Žiadne objednávky pripravené na výdaj.
            <p className="mt-1 text-xs text-neutral-400 dark:text-white/30">
              Objednávky sa tu zobrazia, keď ich kuchyňa označí ako hotové.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            <Section
              title="Moje objednávky"
              count={mine.length}
              hint="Objednávky, ktoré rozvážate vy."
            >
              {mine.map((o) => (
                <OrderCard
                  key={o.id}
                  o={o}
                  userId={userId}
                  isAdmin={isAdmin}
                  busy={busyId === o.id}
                  onClaim={(id) => run(id, claimDispatchOrder)}
                  onRelease={(id) => run(id, releaseDispatchOrder)}
                  onDelivering={(id) => run(id, markDispatchDelivering)}
                  onPaid={(id, card) => run(id, (i) => markDispatchPaid(i, undefined, card))}
                  onEdit={openEdit}
                  editBusy={editLoading}
                />
              ))}
            </Section>

            <Section
              title="Voľné objednávky"
              count={available.length}
              hint="Prevezmite si tie, ktoré rozveziete."
            >
              {available.map((o) => (
                <OrderCard
                  key={o.id}
                  o={o}
                  userId={userId}
                  isAdmin={isAdmin}
                  busy={busyId === o.id}
                  onClaim={(id) => run(id, claimDispatchOrder)}
                  onRelease={(id) => run(id, releaseDispatchOrder)}
                  onDelivering={(id) => run(id, markDispatchDelivering)}
                  onPaid={(id, card) => run(id, (i) => markDispatchPaid(i, undefined, card))}
                  onEdit={openEdit}
                  editBusy={editLoading}
                />
              ))}
            </Section>

            {others.length > 0 && (
              <Section
                title="Rozvážajú kolegovia"
                count={others.length}
                hint="Prevzaté iným kuriérom."
              >
                {others.map((o) => (
                  <OrderCard
                    key={o.id}
                    o={o}
                    userId={userId}
                    isAdmin={isAdmin}
                    busy={busyId === o.id}
                    onClaim={(id) => run(id, claimDispatchOrder)}
                    onRelease={(id) => run(id, releaseDispatchOrder)}
                    onDelivering={(id) => run(id, markDispatchDelivering)}
                    onPaid={(id, card) => run(id, (i) => markDispatchPaid(i, undefined, card))}
                    onEdit={openEdit}
                    editBusy={editLoading}
                  />
                ))}
              </Section>
            )}

            {done.length > 0 && (
              <Section
                title="Dokončené"
                count={done.length}
                hint="Zaplatené — o chvíľu zmiznú."
              >
                <AnimatePresence>
                  {done.map((o) => (
                    <OrderCard
                      key={o.id}
                      o={o}
                      userId={userId}
                      isAdmin={isAdmin}
                      busy={busyId === o.id}
                      onClaim={(id) => run(id, claimDispatchOrder)}
                      onRelease={(id) => run(id, releaseDispatchOrder)}
                      onDelivering={(id) => run(id, markDispatchDelivering)}
                      onPaid={(id, card) => run(id, (i) => markDispatchPaid(i, undefined, card))}
                      onEdit={openEdit}
                      editBusy={editLoading}
                    />
                  ))}
                </AnimatePresence>
              </Section>
            )}
          </div>
        )}

        <p className="mt-10 text-center text-xs text-neutral-400 dark:text-white/25">
          Výdaj z prevádzky: {restaurantName} · {restaurantAddress}
        </p>
      </div>

      {/* edit-order modal */}
      <AnimatePresence>
        {editData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditData(null)}
            className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white dark:bg-[#141414] p-5 sm:rounded-3xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-heading text-lg font-extrabold">
                  Upraviť objednávku #{editData.id}
                </h3>
                <button
                  onClick={() => setEditData(null)}
                  className="rounded-full p-2 text-neutral-500 dark:text-white/50 hover:bg-black/10 dark:hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <StaffOrderForm
                restaurantId={restaurantId}
                orderId={editData.id}
                initial={{
                  fulfillment: editData.fulfillment,
                  name: editData.customerName,
                  phone: editData.phone,
                  address: editData.address,
                  note: editData.note,
                  items: editData.items,
                }}
                onSaved={() => {
                  setEditData(null);
                  refresh();
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function Section({
  title,
  count,
  hint,
  children,
}: {
  title: string;
  count: number;
  hint: string;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-heading text-sm uppercase tracking-[0.15em] text-neutral-700 dark:text-white/70">
          {title}{" "}
          <span className="ml-1 rounded-full bg-black/10 dark:bg-white/10 px-2 py-0.5 text-xs text-neutral-600 dark:text-white/60">
            {count}
          </span>
        </h2>
        <p className="text-xs text-neutral-400 dark:text-white/30">{hint}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function OrderCard({
  o,
  userId,
  isAdmin,
  busy,
  onClaim,
  onRelease,
  onDelivering,
  onPaid,
  onEdit,
  editBusy,
}: {
  o: DispatchOrder;
  userId: string;
  isAdmin: boolean;
  busy: boolean;
  onClaim: (id: string) => void;
  onRelease: (id: string) => void;
  onDelivering: (id: string) => void;
  onPaid: (id: string, card: boolean) => void;
  onEdit: (id: string) => void;
  editBusy: boolean;
}) {
  const isMine = o.driverId === userId;
  const isOther = o.driverId != null && !isMine;
  const isDelivery = o.fulfillment === "delivery";
  // Admins are view-only on the delivery board — no dispatch actions at all.
  const canAct = isMine && !isAdmin;
  const nav = navUrl(o);
  const addr = formatAddress(o.address) || null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={`rounded-2xl border p-4 ${
        o.paid
          ? "border-brand-success/40 bg-brand-success/[0.07]"
          : isMine
          ? "border-brand-primary/50 bg-brand-primary/[0.06]"
          : "border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.02]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-heading text-lg font-extrabold">#{o.id}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-black/10 dark:bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-neutral-700 dark:text-white/70">
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
            {o.paid ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-success/20 px-2 py-0.5 text-[11px] font-semibold text-brand-success">
                <CheckCheck className="h-3 w-3" /> Zaplatené
              </span>
            ) : o.status === "delivering" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-accent/20 px-2 py-0.5 text-[11px] font-semibold text-brand-accent">
                Na ceste
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary/20 px-2 py-0.5 text-[11px] font-semibold text-brand-primary">
                Pripravené
              </span>
            )}
          </div>
          <p className="mt-1 flex items-center gap-1 text-xs text-neutral-500 dark:text-white/40">
            <Clock className="h-3 w-3" /> pred {o.minsAgo} min · {o.customerName}
          </p>
        </div>
        <div className="text-right">
          <p className="font-heading text-lg font-extrabold text-brand-primary">
            {eur(o.total)}
          </p>
          <p className="text-[11px] text-neutral-500 dark:text-white/40">{o.payment}</p>
        </div>
      </div>

      {addr && (
        <p className="mt-3 flex items-start gap-1.5 text-sm text-neutral-700 dark:text-white/75">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
          {addr}
          {o.zoneName && (
            <span className="text-neutral-500 dark:text-white/40"> · {o.zoneName}</span>
          )}
        </p>
      )}

      <ul className="mt-2 text-sm text-neutral-600 dark:text-white/60">
        {o.lines.map((l, i) => (
          <li key={i}>
            {l.quantity}× {l.name}
          </li>
        ))}
      </ul>

      {o.note && (
        <p className="mt-2 rounded-xl bg-black/5 dark:bg-white/5 px-3 py-2 text-xs text-neutral-600 dark:text-white/60">
          Pozn.: {o.note}
        </p>
      )}

      {isOther && !o.paid && (
        <p className="mt-3 text-xs text-neutral-500 dark:text-white/40">
          Prevzal: <span className="text-neutral-700 dark:text-white/70">{o.driverName}</span>
        </p>
      )}

      {/* actions — hidden entirely for admins (view-only) */}
      {!o.paid && !isAdmin && (
        <div className="mt-3 flex flex-wrap gap-2">
          {nav && canAct && (
            <a
              href={nav}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-black/10 dark:bg-white/10 px-3 py-2 text-xs font-semibold text-neutral-800 transition-colors dark:text-white hover:bg-black/15 dark:hover:bg-white/15"
            >
              <Navigation className="h-4 w-4 text-brand-primary" /> Navigovať
            </a>
          )}
          {canAct && (
            <a
              href={telUrl(o.phone)}
              className="inline-flex items-center gap-1.5 rounded-full bg-black/10 dark:bg-white/10 px-3 py-2 text-xs font-semibold text-neutral-800 transition-colors dark:text-white hover:bg-black/15 dark:hover:bg-white/15"
            >
              <Phone className="h-4 w-4 text-brand-success" /> Zavolať
            </a>
          )}

          {!o.driverId && !isAdmin && (
            <button
              disabled={busy}
              onClick={() => onClaim(o.id)}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary px-3 py-2 text-xs font-bold text-white transition-colors hover:brightness-110 disabled:opacity-50"
            >
              <Hand className="h-4 w-4" /> Prevziať
            </button>
          )}

          {canAct && isDelivery && o.status === "ready" && (
            <button
              disabled={busy}
              onClick={() => {
                // Open navigation right away (must be sync for popup rules),
                // then flip the order to "delivering". The Navigovať link stays
                // available while on the road too.
                if (nav) window.open(nav, "_blank", "noopener");
                onDelivering(o.id);
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-accent px-3 py-2 text-xs font-bold text-black transition-colors hover:brightness-110 disabled:opacity-50"
            >
              <Truck className="h-4 w-4" /> Na ceste
            </button>
          )}

          {canAct && (
            <>
              <button
                disabled={busy}
                onClick={() => onPaid(o.id, false)}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-success px-3 py-2 text-xs font-bold text-white transition-colors hover:brightness-110 disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> Hotovosť
              </button>
              <button
                disabled={busy}
                onClick={() => onPaid(o.id, true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary px-3 py-2 text-xs font-bold text-white transition-colors hover:brightness-110 disabled:opacity-50"
              >
                <CreditCard className="h-4 w-4" /> Karta
              </button>
            </>
          )}

          {canAct && o.driverId && (
            <button
              disabled={busy}
              onClick={() => onRelease(o.id)}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/15 dark:border-white/15 px-3 py-2 text-xs font-semibold text-neutral-600 dark:text-white/60 transition-colors hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" /> Uvoľniť
            </button>
          )}

          {canAct && (
            <button
              disabled={editBusy}
              onClick={() => onEdit(o.id)}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/15 dark:border-white/15 px-3 py-2 text-xs font-semibold text-neutral-700 dark:text-white/80 transition-colors hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
            >
              <Pencil className="h-4 w-4" /> Upraviť
            </button>
          )}
        </div>
      )}

      {o.paid && (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-brand-success">
          <CheckCheck className="h-4 w-4" /> Vybavené
          {o.driverName && ` · ${o.driverName}`}
        </p>
      )}
    </motion.div>
  );
}

// Shown to a staff member who has no shift today. They stay logged in but can't
// work — the admin assigns shifts when opening the pizzeria.
export function NoShift({
  name,
  restaurantName,
}: {
  name: string;
  restaurantName: string;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-100 p-6 text-center text-neutral-900 dark:bg-[#0a0a0a] dark:text-white">
      <div className="w-full max-w-sm rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.02] p-8">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-black/5 dark:bg-white/5 text-3xl">
          😴
        </span>
        <h1 className="font-heading text-2xl uppercase tracking-tight">
          Dnes nemáš šichtu
        </h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-white/50">
          {name}, na dnes ti v prevádzke {restaurantName} nebola pridelená
          služba. Ak je to omyl, ozvi sa vedúcemu.
        </p>
        <LogoutButton className="mt-6 inline-flex items-center gap-2 rounded-full border border-black/15 dark:border-white/15 px-5 py-2.5 text-sm font-semibold text-neutral-700 dark:text-white/80 transition-colors hover:bg-black/5 dark:hover:bg-white/5" />
      </div>
    </main>
  );
}
