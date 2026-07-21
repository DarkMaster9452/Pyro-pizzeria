"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/lib/auth-actions";

// Staff logout with a confirmation step, so a mis-tap never drops someone out
// of their shift. Styling is passed in so each staff surface keeps its own look.
export function LogoutButton({
  className,
  label = "Odhlásiť",
}: {
  className?: string;
  label?: string;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setConfirm(true)} className={className}>
        <LogOut className="h-4 w-4" /> {label}
      </button>

      {confirm && (
        <div
          onClick={() => setConfirm(false)}
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl dark:bg-[#1b1b1b]"
          >
            <h3 className="font-display text-lg font-extrabold text-neutral-900 dark:text-white">
              Odhlásiť sa?
            </h3>
            <p className="mt-1 text-sm text-neutral-500">
              Budete sa musieť znova prihlásiť menom a heslom.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirm(false)}
                className="flex-1 rounded-full border border-black/10 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-black/5 dark:border-white/15 dark:text-neutral-200 dark:hover:bg-white/5"
              >
                Zrušiť
              </button>
              <form action={logoutAction} className="flex-1">
                <button
                  type="submit"
                  className="w-full rounded-full bg-brand-error py-2.5 text-sm font-bold text-white hover:brightness-110"
                >
                  Odhlásiť
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
