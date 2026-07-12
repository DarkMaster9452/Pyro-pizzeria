"use client";

import Link from "next/link";
import { useApp } from "@/lib/store";
import { RESTAURANTS } from "@/lib/data";
import { eur } from "@/lib/utils";
import { useEffect, useState } from "react";
import {
  logoutAction,
  logoutAllDevicesAction,
  deleteAccountAction,
  exportAccountAction,
} from "@/lib/auth-actions";
import { getMyOrders, type MyOrderRow } from "@/lib/server-actions";
import {
  Clock,
  Bell,
  LogOut,
  Download,
  Trash2,
  ShieldCheck,
  MonitorSmartphone,
} from "lucide-react";

const ORDER_STATUS_LABEL: Record<string, string> = {
  received: "Prijaté",
  accepted: "Potvrdené",
  preparing: "Pripravuje sa",
  ready: "Pripravené",
  delivering: "Na ceste",
  delivered: "Doručené",
  cancelled: "Zrušené",
};

export function AccountDashboard({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  const localOrders = useApp((s) => s.orders);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dbOrders, setDbOrders] = useState<MyOrderRow[] | null>(null);

  useEffect(() => {
    getMyOrders()
      .then(setDbOrders)
      .catch(() => setDbOrders([]));
  }, []);

  // Prefer the account-linked orders from the database (they persist across
  // devices); fall back to the locally-stored ones until they load.
  const orders =
    dbOrders && dbOrders.length
      ? dbOrders.map((o) => ({
          id: o.id,
          restaurantId: o.restaurantId,
          total: o.total,
          lineCount: o.lines.length,
          status: o.status,
          paid: o.paid,
        }))
      : localOrders.map((o) => ({
          id: o.id,
          restaurantId: o.restaurantId,
          total: o.total,
          lineCount: o.lines.length,
          status: o.status,
          paid: false,
        }));

  async function exportData() {
    const data = await exportAccountAction();
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "moje-udaje.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-primary to-brand-secondary text-2xl font-bold text-white">
          {(name || email).slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h1 className="font-heading text-3xl uppercase tracking-tight text-white">
            {name || "Môj účet"}
          </h1>
          <p className="text-sm text-[#B5B5B5]">{email}</p>
        </div>
        <form action={logoutAction} className="ml-auto">
          <button className="btn-ghost">
            <LogOut className="h-4 w-4" /> Odhlásiť
          </button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-white/[0.08] bg-[#141414] p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-white">
            <Clock className="h-5 w-5 text-brand-secondary" /> História objednávok
          </h2>
          {orders.length === 0 ? (
            <p className="text-sm text-[#B5B5B5]">Zatiaľ žiadne objednávky.</p>
          ) : (
            <div className="space-y-3">
              {orders.map((o) => {
                const r = RESTAURANTS.find((x) => x.id === o.restaurantId);
                return (
                  <div
                    key={o.id}
                    className="flex items-center justify-between rounded-xl bg-white/[0.03] p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white">#{o.id}</p>
                        {o.paid ? (
                          <span className="rounded-full bg-brand-success/20 px-2 py-0.5 text-[11px] font-semibold text-brand-success">
                            Zaplatené
                          </span>
                        ) : (
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/60">
                            {ORDER_STATUS_LABEL[o.status] ?? o.status}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400">
                        {r?.name} · {o.lineCount} položiek
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-brand-primary">
                        {eur(o.total)}
                      </p>
                      <Link
                        href={`/track?id=${o.id}`}
                        className="text-xs font-semibold text-brand-secondary"
                      >
                        Sledovať / Objednať znova
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-white/[0.08] bg-[#141414] p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-white">
            <Bell className="h-5 w-5 text-brand-accent" /> Notifikácie
          </h2>
          <div className="grid gap-2">
            {["Email", "SMS", "Push"].map((n) => (
              <label
                key={n}
                className="flex items-center justify-between rounded-xl bg-white/[0.03] p-3 text-white"
              >
                <span className="font-medium">{n}</span>
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-5 w-5 accent-brand-primary"
                />
              </label>
            ))}
          </div>
        </section>

        {/* GDPR / security */}
        <section className="rounded-3xl border border-white/[0.08] bg-[#141414] p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-white">
            <ShieldCheck className="h-5 w-5 text-brand-success" /> Súkromie a
            bezpečnosť
          </h2>
          <div className="space-y-2.5 text-sm">
            <button
              onClick={exportData}
              className="flex w-full items-center gap-3 rounded-xl bg-white/[0.03] p-3 text-left text-white hover:bg-white/[0.06]"
            >
              <Download className="h-4 w-4 text-brand-secondary" />
              Exportovať moje údaje (GDPR)
            </button>
            <form action={logoutAllDevicesAction}>
              <button className="flex w-full items-center gap-3 rounded-xl bg-white/[0.03] p-3 text-left text-white hover:bg-white/[0.06]">
                <MonitorSmartphone className="h-4 w-4 text-brand-secondary" />
                Odhlásiť zo všetkých zariadení
              </button>
            </form>
            {confirmDelete ? (
              <div className="rounded-xl border border-brand-error/30 bg-brand-error/10 p-3">
                <p className="mb-2 text-[#ffb4b4]">
                  Naozaj natrvalo zmazať účet? Túto akciu nie je možné vrátiť.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 rounded-full border border-white/15 py-2 font-semibold text-white"
                  >
                    Zrušiť
                  </button>
                  <form action={deleteAccountAction} className="flex-1">
                    <button className="w-full rounded-full bg-brand-error py-2 font-bold text-white">
                      Zmazať účet
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex w-full items-center gap-3 rounded-xl bg-brand-error/10 p-3 text-left font-semibold text-[#ff8f8f] hover:bg-brand-error/15"
              >
                <Trash2 className="h-4 w-4" />
                Zmazať účet
              </button>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
