"use client";

import Link from "next/link";
import { RESTAURANTS } from "@/lib/data";
import { eur } from "@/lib/utils";
import { useEffect, useState } from "react";
import {
  logoutAction,
  logoutAllDevicesAction,
  deleteAccountAction,
  exportAccountAction,
} from "@/lib/auth-actions";
import {
  getMyOrders,
  getNotificationPrefs,
  setEmailNotifications,
  type MyOrderRow,
} from "@/lib/server-actions";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import {
  Clock,
  Bell,
  LogOut,
  Download,
  Trash2,
  ShieldCheck,
  MonitorSmartphone,
  KeyRound,
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [dbOrders, setDbOrders] = useState<MyOrderRow[] | null>(null);
  const [emailOptIn, setEmailOptIn] = useState(true);
  const [savingEmail, setSavingEmail] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);

  useEffect(() => {
    getMyOrders()
      .then(setDbOrders)
      .catch(() => setDbOrders([]));
    getNotificationPrefs()
      .then((p) => setEmailOptIn(p.email))
      .catch(() => {});
  }, []);

  async function toggleEmail(next: boolean) {
    setEmailOptIn(next); // optimistic
    setSavingEmail(true);
    const res = await setEmailNotifications(next).catch(() => ({ ok: false }));
    setSavingEmail(false);
    if (!res.ok) setEmailOptIn(!next); // revert on failure
  }

  // Only orders actually linked to this account (placed while signed in on this
  // device). Orders made logged-out belong to the name, not the account.
  const orders = (dbOrders ?? []).map((o) => ({
    id: o.id,
    restaurantId: o.restaurantId,
    total: o.total,
    lineCount: o.lines.length,
    status: o.status,
    paid: o.paid,
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
      <div className="mb-8 flex items-center gap-3 sm:gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-primary to-brand-secondary text-2xl font-bold text-white sm:h-16 sm:w-16">
          {(name || email).slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-heading text-2xl uppercase tracking-tight text-white sm:text-3xl">
            {name || "Môj účet"}
          </h1>
          <p className="truncate text-sm text-[#B5B5B5]">{email}</p>
        </div>
        <form action={logoutAction} className="shrink-0">
          <button className="btn-ghost px-3 sm:px-4">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Odhlásiť</span>
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
          <label className="flex items-center justify-between rounded-xl bg-white/[0.03] p-3 text-white">
            <span>
              <span className="font-medium">Emailové notifikácie</span>
              <span className="block text-xs text-[#B5B5B5]">
                Novinky a informácie o objednávkach na váš email.
              </span>
            </span>
            <input
              type="checkbox"
              checked={emailOptIn}
              disabled={savingEmail}
              onChange={(e) => toggleEmail(e.target.checked)}
              className="h-5 w-5 accent-brand-primary"
            />
          </label>
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
            {showChangePw ? (
              <div className="rounded-xl bg-white/[0.03] p-3">
                <p className="mb-2 flex items-center gap-2 font-semibold text-white">
                  <KeyRound className="h-4 w-4 text-brand-secondary" /> Zmeniť
                  heslo
                </p>
                <ChangePasswordForm note="Nepovinné — heslo môžete zmeniť najviac raz za týždeň." />
                <button
                  onClick={() => setShowChangePw(false)}
                  className="mt-2 text-xs font-semibold text-[#B5B5B5] hover:text-white"
                >
                  Zavrieť
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowChangePw(true)}
                className="flex w-full items-center gap-3 rounded-xl bg-white/[0.03] p-3 text-left text-white hover:bg-white/[0.06]"
              >
                <KeyRound className="h-4 w-4 text-brand-secondary" />
                Zmeniť heslo
              </button>
            )}
            <form action={logoutAllDevicesAction}>
              <button className="flex w-full items-center gap-3 rounded-xl bg-white/[0.03] p-3 text-left text-white hover:bg-white/[0.06]">
                <MonitorSmartphone className="h-4 w-4 text-brand-secondary" />
                Odhlásiť zo všetkých zariadení
              </button>
              <p className="mt-1.5 px-3 text-xs text-[#8a8a8a]">
                Zneplatní prihlásenie na všetkých zariadeniach, kde ste boli
                prihlásení (mobil, počítač…). Všade vás odhlási a na ďalšie
                použitie sa treba znova prihlásiť heslom. Hodí sa, ak ste sa
                prihlásili na cudzom zariadení alebo máte podozrenie, že heslo
                pozná niekto iný.
              </p>
            </form>
            {confirmDelete ? (
              <div className="rounded-xl border border-brand-error/30 bg-brand-error/10 p-3">
                <p className="mb-2 text-[#ffb4b4]">
                  Naozaj natrvalo zmazať účet? Túto akciu nie je možné vrátiť.
                  Pre potvrdenie napíšte <strong>potvrdzujem</strong>:
                </p>
                <form action={deleteAccountAction} className="space-y-2">
                  <input
                    name="confirm"
                    value={deleteText}
                    onChange={(e) => setDeleteText(e.target.value)}
                    placeholder="potvrdzujem"
                    autoComplete="off"
                    className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-error"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDelete(false);
                        setDeleteText("");
                      }}
                      className="flex-1 rounded-full border border-white/15 py-2 font-semibold text-white"
                    >
                      Zrušiť
                    </button>
                    <button
                      type="submit"
                      disabled={deleteText.trim().toLowerCase() !== "potvrdzujem"}
                      className="flex-1 rounded-full bg-brand-error py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Zmazať účet
                    </button>
                  </div>
                </form>
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
