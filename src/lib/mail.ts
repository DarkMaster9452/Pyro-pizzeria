import "server-only";
import { logError, logWarn } from "./log";

// ---------------------------------------------------------------------------
// Transactional email.
//
// Sending is done over Resend's HTTP API with plain `fetch`, so no extra
// dependency is pulled in and it works on the Edge runtime as well. The whole
// module is optional: with no API key configured `sendMail` becomes a no-op
// that returns false, so every caller keeps working on a deployment that has
// no mail provider yet (local dev, previews).
// ---------------------------------------------------------------------------

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

/**
 * Absolute base URL of the deployment, used to build links inside emails.
 * Read from configuration only — never from the request's Host header, which
 * an attacker can spoof to make us send a poisoned reset link.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export interface MailInput {
  to: string;
  subject: string;
  /** Plain-text body. Always sent; keeps us out of HTML-escaping trouble. */
  text: string;
}

/**
 * Send one transactional email. Never throws — a mail failure must not break
 * the surrounding request (a login, a password reset). Returns whether the
 * message was actually handed to the provider.
 */
export async function sendMail(input: MailInput): Promise<boolean> {
  if (!mailConfigured()) {
    logWarn("mail", `not configured — skipped "${input.subject}"`);
    return false;
  }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [input.to],
        subject: input.subject,
        text: input.text,
      }),
    });
    if (!res.ok) {
      // Body may carry the provider's reason; status alone is often enough.
      logError("mail", `provider returned ${res.status}`);
      return false;
    }
    return true;
  } catch (e) {
    logError("mail", e);
    return false;
  }
}
