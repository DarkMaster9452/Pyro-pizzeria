"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Cloudflare Turnstile widget.
//
// Renders nothing at all when no site key is configured, so local dev and
// previews keep working without a Cloudflare account — the server-side check in
// lib/captcha.ts is skipped in exactly the same case.
//
// The script is injected from inside an effect rather than via a <script> tag
// in the markup: our CSP uses 'strict-dynamic', under which a script added by
// already-trusted code (the React bundle, which carries the nonce) is allowed,
// while a hand-written tag would need its own nonce.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
    }
  ) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

// One shared load across every widget instance on the page.
let loader: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  if (loader) return loader;
  loader = new Promise<void>((resolve, reject) => {
    if (window.turnstile) return resolve();
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loader = null; // allow a retry on the next mount
      reject(new Error("Turnstile failed to load"));
    };
    document.head.appendChild(script);
  });
  return loader;
}

export interface CaptchaProps {
  /** Hidden field name — must match what the server action reads. */
  name?: string;
  /** Notified as the token arrives/expires, for non-form (RPC) submissions. */
  onToken?: (token: string) => void;
}

export default function Captcha({
  name = "captchaToken",
  onToken,
}: CaptchaProps) {
  const holder = useRef<HTMLDivElement | null>(null);
  const [token, setToken] = useState("");

  const emit = useCallback(
    (value: string) => {
      setToken(value);
      onToken?.(value);
    },
    [onToken]
  );

  useEffect(() => {
    if (!SITE_KEY) return;
    let widgetId: string | undefined;
    let cancelled = false;

    loadTurnstile()
      .then(() => {
        if (cancelled || !holder.current || !window.turnstile) return;
        widgetId = window.turnstile.render(holder.current, {
          sitekey: SITE_KEY,
          callback: (t) => emit(t),
          "expired-callback": () => emit(""),
          "error-callback": () => emit(""),
          theme: "dark",
        });
      })
      .catch(() => {
        // Cloudflare unreachable. The server treats a transport failure as a
        // pass, so the customer is not stranded — see lib/captcha.ts.
      });

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch {
          // widget already gone
        }
      }
    };
  }, [emit]);

  if (!SITE_KEY) return null;

  return (
    <div className="space-y-2">
      <div ref={holder} className="flex justify-center" />
      <input type="hidden" name={name} value={token} />
    </div>
  );
}

/** Whether the widget is active at all — lets callers hide their own hints. */
export const captchaEnabled = Boolean(SITE_KEY);
