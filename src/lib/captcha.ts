import "server-only";
import { logError } from "./log";
import { clientIp } from "./security";

// ---------------------------------------------------------------------------
// Bot protection — Cloudflare Turnstile.
//
// Verified server-side on every protected action (login, registration, order,
// password-reset request). Optional: with no keys configured the check is
// skipped entirely, so the app still runs locally and on previews. Turnstile's
// "managed" mode is invisible for ordinary visitors, so a real customer never
// sees a puzzle — only automated traffic gets challenged.
// ---------------------------------------------------------------------------

const VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function captchaConfigured(): boolean {
  return Boolean(
    process.env.TURNSTILE_SECRET_KEY &&
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  );
}

export type CaptchaResult = { ok: true } | { ok: false; error: string };

const MISSING = "Overenie proti robotom sa nepodarilo. Skúste to znova.";

/**
 * Validate a Turnstile token submitted with a form.
 *
 * Fails CLOSED on an explicit negative verdict from Cloudflare, and OPEN when
 * Cloudflare itself is unreachable — the same trade-off the rate limiter makes:
 * a provider outage must never stop real customers from ordering, and the
 * per-IP limits still apply underneath.
 */
export async function verifyCaptcha(
  token: FormDataEntryValue | string | null | undefined
): Promise<CaptchaResult> {
  if (!captchaConfigured()) return { ok: true };

  const value = typeof token === "string" ? token.trim() : "";
  if (!value) return { ok: false, error: MISSING };

  try {
    const body = new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY!,
      response: value,
    });
    const ip = await clientIp();
    if (ip && ip !== "unknown") body.set("remoteip", ip);

    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      logError("captcha", `siteverify returned ${res.status}`);
      return { ok: true }; // provider trouble — do not block real traffic
    }
    const data = (await res.json()) as { success?: boolean };
    return data.success === true ? { ok: true } : { ok: false, error: MISSING };
  } catch (e) {
    logError("captcha", e);
    return { ok: true }; // network trouble — see the doc comment above
  }
}
