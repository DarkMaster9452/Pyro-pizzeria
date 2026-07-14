"use client";

import { useState } from "react";
import { changePasswordAction } from "@/lib/auth-actions";
import { KeyRound, Loader2, Check } from "lucide-react";

// Shared self-service password change. `onSuccess` lets the caller react (staff
// boards sign out and force a re-login; the customer account just confirms).
export function ChangePasswordForm({
  onSuccess,
  note,
}: {
  onSuccess?: () => void;
  note?: string;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (next !== confirm) {
      setErr("Nové heslá sa nezhodujú.");
      return;
    }
    setBusy(true);
    const res = await changePasswordAction(current, next).catch(() => ({
      ok: false,
      error: "Heslo sa nepodarilo zmeniť.",
    }));
    setBusy(false);
    if (res.ok) {
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      onSuccess?.();
    } else {
      setErr(res.error ?? "Heslo sa nepodarilo zmeniť.");
    }
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-brand-success/10 p-3 text-sm font-semibold text-brand-success">
        <Check className="h-4 w-4" /> Heslo bolo zmenené.
      </div>
    );
  }

  const inputCls =
    "w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-brand-primary dark:border-white/10 dark:bg-[#111] dark:text-white";

  return (
    <form onSubmit={submit} className="space-y-2.5">
      {note && <p className="text-xs text-neutral-500">{note}</p>}
      <input
        type="password"
        autoComplete="current-password"
        placeholder="Súčasné heslo"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        className={inputCls}
        required
      />
      <input
        type="password"
        autoComplete="new-password"
        placeholder="Nové heslo"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        className={inputCls}
        required
      />
      <input
        type="password"
        autoComplete="new-password"
        placeholder="Zopakujte nové heslo"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className={inputCls}
        required
      />
      <p className="text-[11px] text-neutral-500">
        Aspoň 10 znakov, veľké aj malé písmeno a číslica.
      </p>
      {err && <p className="text-sm text-brand-error">{err}</p>}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-4 py-2 text-sm font-bold text-white hover:brightness-110 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <KeyRound className="h-4 w-4" />
        )}
        Zmeniť heslo
      </button>
    </form>
  );
}
