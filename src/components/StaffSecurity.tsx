"use client";

import { useEffect, useState } from "react";
import {
  getStaffPasswordNotice,
  type StaffPasswordNotice,
} from "@/lib/server-actions";
import { logoutAction } from "@/lib/auth-actions";
import { OPERATOR_CONTACT } from "@/lib/data";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { KeyRound, Phone, Mail, LifeBuoy, AlertTriangle } from "lucide-react";

// After a password change the session is invalidated (session_version bumped),
// so sign the staff member out and back in with the new password.
async function reloginAfterChange() {
  await logoutAction().catch(() => {});
}

// Staff password-rotation banner. Nothing renders unless the password is close
// to (remindSoon) or past (mustChange) the 30-day limit. When it must change,
// the form is shown expanded and cannot be dismissed.
export function StaffPasswordBanner() {
  const [notice, setNotice] = useState<StaffPasswordNotice | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getStaffPasswordNotice()
      .then((n) => {
        setNotice(n);
        if (n?.mustChange) setOpen(true);
      })
      .catch(() => {});
  }, []);

  if (!notice || (!notice.mustChange && !notice.remindSoon)) return null;

  const daysLeft = Math.max(0, notice.maxAgeDays - notice.ageDays);
  const critical = notice.mustChange;

  return (
    <div
      className={
        "mb-4 rounded-2xl border p-4 " +
        (critical
          ? "border-brand-error/40 bg-brand-error/10"
          : "border-amber-500/40 bg-amber-500/10")
      }
    >
      <div className="flex items-start gap-3">
        <span
          className={
            "mt-0.5 shrink-0 " +
            (critical ? "text-brand-error" : "text-amber-500")
          }
        >
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={
              "font-display font-bold " +
              (critical ? "text-brand-error" : "text-amber-600 dark:text-amber-400")
            }
          >
            {critical
              ? "Heslo vypršalo — pred začatím dňa si ho zmeňte"
              : `Heslo vyprší o ${daysLeft} ${daysLeft === 1 ? "deň" : "dni"}`}
          </p>
          <p className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-300">
            Heslá zamestnancov sa menia každých {notice.maxAgeDays} dní.
            {critical
              ? " Prevádzku nie je možné otvoriť, kým si heslo nezmeníte."
              : " Zmeňte si ho teraz, aby vás to nezastavilo počas služby."}
          </p>

          {!open && !critical && (
            <button
              onClick={() => setOpen(true)}
              className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:brightness-110"
            >
              <KeyRound className="h-4 w-4" /> Zmeniť heslo
            </button>
          )}

          {open && (
            <div className="mt-3 max-w-sm">
              <ChangePasswordForm onSuccess={reloginAfterChange} />
              <p className="mt-2 text-xs text-neutral-500">
                Po zmene vás odhlásime — prihláste sa novým heslom.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Owner / operator emergency contact — staff-only (never shown to the public).
export function OperatorContact({ className }: { className?: string }) {
  return (
    <div
      className={
        "rounded-2xl border border-black/[0.08] bg-white p-4 dark:border-white/5 dark:bg-[#1a1a1a] " +
        (className ?? "")
      }
    >
      <p className="mb-2 flex items-center gap-2 text-sm font-bold text-neutral-900 dark:text-white">
        <LifeBuoy className="h-4 w-4 text-brand-secondary" /> Kontakt na
        prevádzkara
      </p>
      <p className="mb-2 text-xs text-neutral-500">
        Ak sa niečo pokazí počas služby, volajte:
      </p>
      <div className="flex flex-col gap-1.5 text-sm">
        <a
          href={`tel:${OPERATOR_CONTACT.phone.replace(/\s+/g, "")}`}
          className="inline-flex items-center gap-2 font-semibold text-brand-primary hover:underline"
        >
          <Phone className="h-4 w-4" /> {OPERATOR_CONTACT.phone}
        </a>
        <a
          href={`mailto:${OPERATOR_CONTACT.email}`}
          className="inline-flex items-center gap-2 text-neutral-700 hover:underline dark:text-neutral-300"
        >
          <Mail className="h-4 w-4" /> {OPERATOR_CONTACT.email}
        </a>
      </div>
    </div>
  );
}

// Full self-service password panel for the admin Prevádzka tab (always
// available, not just when expiring).
export function StaffPasswordPanel() {
  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white p-5 dark:border-white/5 dark:bg-[#1a1a1a]">
      <p className="mb-1 flex items-center gap-2 font-display text-base font-bold text-neutral-900 dark:text-white">
        <KeyRound className="h-5 w-5 text-brand-secondary" /> Zmena hesla
      </p>
      <p className="mb-3 text-sm text-neutral-500">
        Heslá zamestnancov sa menia každých 30 dní. Po zmene vás odhlásime —
        prihláste sa novým heslom.
      </p>
      <div className="max-w-sm">
        <ChangePasswordForm onSuccess={reloginAfterChange} />
      </div>
    </div>
  );
}
