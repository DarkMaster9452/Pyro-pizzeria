"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { logoutAction } from "@/lib/auth-actions";
import { AlertTriangle } from "lucide-react";

// Idle auto-logout for the admin panel.
//
// The session itself already expires (8h), which bounds a stolen cookie but
// does nothing about an unattended browser in the pizzeria. This closes that
// window: no interaction for `timeoutMinutes` and the admin is signed out, with
// a countdown in the last minute so nobody loses work mid-edit.
//
// Deliberately mounted on /admin only. The kitchen, dispatch and counter boards
// are watched passively for long stretches of a shift — logging those out would
// interrupt service for no security gain, since they hold no admin rights.

const DEFAULT_TIMEOUT_MINUTES = 30;
const WARN_SECONDS = 60;

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "visibilitychange",
] as const;

export function IdleTimeout({
  timeoutMinutes = DEFAULT_TIMEOUT_MINUTES,
}: {
  timeoutMinutes?: number;
}) {
  const deadline = useRef<number>(Date.now() + timeoutMinutes * 60_000);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const signingOut = useRef(false);

  const reset = useCallback(() => {
    deadline.current = Date.now() + timeoutMinutes * 60_000;
    setSecondsLeft(null);
  }, [timeoutMinutes]);

  useEffect(() => {
    // Passive listeners: this must not add any cost to scrolling the order list.
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, reset, { passive: true });
    }

    // One timer polling the deadline, rather than re-arming a timeout on every
    // mouse move — cheaper, and it survives the tab being suspended.
    const tick = setInterval(() => {
      const remaining = Math.ceil((deadline.current - Date.now()) / 1000);
      if (remaining <= 0) {
        if (signingOut.current) return;
        signingOut.current = true;
        logoutAction().catch(() => {
          // Server unreachable — fall back to a reload so the guarded page
          // re-checks the session rather than staying open.
          window.location.href = "/login";
        });
        return;
      }
      setSecondsLeft(remaining <= WARN_SECONDS ? remaining : null);
    }, 1000);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, reset);
      }
      clearInterval(tick);
    };
  }, [reset]);

  if (secondsLeft == null) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-3 bg-brand-error/95 px-4 py-3 text-sm font-semibold text-white"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        Pre neaktivitu vás o {secondsLeft} s odhlásime. Pohnite myšou pre
        pokračovanie.
      </span>
    </div>
  );
}
