"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCallBoard, type CallOrder } from "@/lib/server-actions";
import { logoutAction } from "@/lib/auth-actions";
import { eur } from "@/lib/utils";
import {
  PhoneCall,
  Phone,
  Truck,
  Store,
  Clock,
  RefreshCw,
  LogOut,
} from "lucide-react";

function telUrl(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, "")}`;
}

// The call/counter board. This account can do nothing but watch finished orders
// and tap a customer's number to call them. Orders are split into delivery
// (dovoz) and pickup (odber) by a toggle.
export function CallApp({
  name,
  restaurantName,
}: {
  name: string;
  restaurantName: string;
}) {
  const [orders, setOrders] = useState<CallOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<"delivery" | "pickup">("delivery");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(() => {
    getCallBoard()
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

  const delivery = orders.filter((o) => o.fulfillment === "delivery");
  const pickup = orders.filter((o) => o.fulfillment === "pickup");
  const list = tab === "delivery" ? delivery : pickup;

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-primary/15 text-brand-primary">
              <PhoneCall className="h-5 w-5" />
            </span>
            <div>
              <p className="font-heading text-lg uppercase leading-none tracking-tight">
                Telefón
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
            <form action={logoutAction}>
              <button className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 transition-colors hover:bg-white/5">
                <LogOut className="h-4 w-4" /> Odhlásiť
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6">
        {/* dovoz / odber toggle */}
        <div className="mb-6 grid grid-cols-2 gap-2">
          {(
            [
              {
                id: "delivery",
                label: "Dovoz",
                icon: <Truck className="h-4 w-4" />,
                count: delivery.length,
              },
              {
                id: "pickup",
                label: "Odber",
                icon: <Store className="h-4 w-4" />,
                count: pickup.length,
              },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center justify-center gap-2 rounded-2xl border-2 py-3 text-sm font-bold transition-colors ${
                tab === t.id
                  ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                  : "border-white/10 text-white/60 hover:bg-white/5"
              }`}
            >
              {t.icon}
              {t.label}
              <span
                className={`ml-1 rounded-full px-2 py-0.5 text-xs ${
                  tab === t.id
                    ? "bg-brand-primary/20"
                    : "bg-white/10 text-white/60"
                }`}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {!loaded ? (
          <p className="py-20 text-center text-white/40">Načítavam…</p>
        ) : list.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center text-white/40">
            <PhoneCall className="mx-auto mb-3 h-10 w-10 opacity-40" />
            Žiadne hotové objednávky na {tab === "delivery" ? "dovoz" : "odber"}.
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {list.map((o) => (
                <motion.div
                  key={o.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-heading text-lg font-extrabold">
                        #{o.id}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/70">
                        {o.status === "delivering" ? "Na ceste" : "Hotové"}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-white/70">
                      {o.customerName || "Bez mena"}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-white/40">
                      <Clock className="h-3 w-3" /> pred {o.minsAgo} min ·{" "}
                      {eur(o.total)}
                    </p>
                  </div>

                  {o.phone ? (
                    <a
                      href={telUrl(o.phone)}
                      className="flex shrink-0 items-center gap-2 rounded-full bg-brand-success px-5 py-3 text-sm font-bold text-white transition-colors hover:brightness-110"
                    >
                      <Phone className="h-5 w-5" /> Zavolať
                    </a>
                  ) : (
                    <span className="shrink-0 text-xs text-white/30">
                      bez čísla
                    </span>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </main>
  );
}
