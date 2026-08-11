import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { sql } from "./db";
import { logError } from "./log";
import { sendMail } from "./mail";
import { getEmailOptIn } from "./users";

// ---------------------------------------------------------------------------
// "New device" login notifications.
//
// After a successful sign-in we record a coarse fingerprint of the browser. The
// first time an account is used from a fingerprint we have not seen before, the
// owner gets an email — the standard early warning for a stolen password.
//
// The fingerprint is the User-Agent only, hashed with AUTH_SECRET as the salt.
// Deliberately NOT including the IP: phones roam between mobile networks
// constantly, and an IP-sensitive fingerprint would bury real warnings under a
// stream of false alarms. What we want to catch is "someone signed in from a
// different browser", and the User-Agent carries exactly that.
//
// Keyed by email so the table stays independent of the users table's key type.
// ---------------------------------------------------------------------------

let tablePromise: Promise<void> | null = null;
async function ensureDeviceTable(): Promise<void> {
  if (tablePromise) return tablePromise;
  tablePromise = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS known_devices (
        email text NOT NULL,
        fingerprint text NOT NULL,
        label text NOT NULL DEFAULT '',
        first_seen timestamptz NOT NULL DEFAULT now(),
        last_seen timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (email, fingerprint)
      )`;
  })().catch((e) => {
    tablePromise = null;
    throw e;
  });
  return tablePromise;
}

// Human-readable summary of a User-Agent for the alert email. Intentionally
// rough — it only has to help the owner recognise "that was me".
function describeAgent(ua: string): string {
  if (!ua) return "neznáme zariadenie";
  const os = /Android/i.test(ua)
    ? "Android"
    : /iPhone|iPad|iOS/i.test(ua)
    ? "iPhone / iPad"
    : /Windows/i.test(ua)
    ? "Windows"
    : /Macintosh|Mac OS/i.test(ua)
    ? "Mac"
    : /Linux/i.test(ua)
    ? "Linux"
    : "neznámy systém";
  const browser = /Edg\//i.test(ua)
    ? "Edge"
    : /OPR\//i.test(ua)
    ? "Opera"
    : /Firefox\//i.test(ua)
    ? "Firefox"
    : /Chrome\//i.test(ua)
    ? "Chrome"
    : /Safari\//i.test(ua)
    ? "Safari"
    : "neznámy prehliadač";
  return `${browser} na ${os}`;
}

/**
 * Record the current browser for `email` and, when it has not been seen before,
 * email the account owner. Never throws and never blocks the login — a failure
 * here is logged and swallowed.
 *
 * The very first device an account ever uses is recorded silently: that one is
 * the sign-up/first login itself, and warning about it would just be noise.
 */
export async function notifyNewDevice(
  email: string,
  userId: string | null | undefined,
  ip: string
): Promise<void> {
  try {
    await ensureDeviceTable();
    const h = await headers();
    const ua = h.get("user-agent") ?? "";
    const fingerprint = createHash("sha256")
      .update(`${process.env.AUTH_SECRET ?? ""}|${ua}`)
      .digest("hex");

    // Was this the account's first device ever? Checked before the upsert.
    const seen = (await sql`
      SELECT COUNT(*)::int AS n FROM known_devices WHERE email = ${email}
    `) as { n: number }[];
    const isFirstEver = (seen[0]?.n ?? 0) === 0;

    const inserted = (await sql`
      INSERT INTO known_devices (email, fingerprint, label)
      VALUES (${email}, ${fingerprint}, ${describeAgent(ua)})
      ON CONFLICT (email, fingerprint)
        DO UPDATE SET last_seen = now()
      RETURNING (xmax = 0) AS is_new
    `) as { is_new: boolean }[];

    if (!inserted[0]?.is_new || isFirstEver) return;

    // Respect the account's email preference.
    if (userId) {
      const optedIn = await getEmailOptIn(userId).catch(() => true);
      if (!optedIn) return;
    }

    const when = new Date().toLocaleString("sk-SK", {
      timeZone: "Europe/Bratislava",
    });
    await sendMail({
      to: email,
      subject: "Nové prihlásenie do vášho účtu — Pyro & Polomárik",
      text: [
        "Dobrý deň,",
        "",
        "do vášho účtu sa práve niekto prihlásil z nového zariadenia:",
        "",
        `  Zariadenie: ${describeAgent(ua)}`,
        `  Čas:        ${when}`,
        `  IP adresa:  ${ip}`,
        "",
        "Ak ste to boli vy, nemusíte robiť nič.",
        "Ak nie, čo najskôr si zmeňte heslo vo svojom účte a odhláste sa",
        "zo všetkých zariadení.",
        "",
        "Pyro & Polomárik",
      ].join("\n"),
    });
  } catch (e) {
    logError("notifyNewDevice", e);
  }
}
