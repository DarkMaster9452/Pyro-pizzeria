import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { sql } from "./db";
import { logError } from "./log";
import { sendMail, siteUrl } from "./mail";

// ---------------------------------------------------------------------------
// "Forgot my password" flow.
//
// Rules the tokens follow:
//   * random 256-bit token, handed out once in the email link and never stored
//   * only the SHA-256 hash lives in the database, so a database leak does not
//     hand out working reset links
//   * short TTL (30 min) and single use — consuming one deletes every
//     outstanding token for that address
//   * the request endpoint answers identically for known and unknown
//     addresses, so it cannot be used to enumerate registered customers
//
// Rows are keyed by email rather than user id: it keeps the table independent
// of the users table's key type, and a token for a deleted account simply
// stops resolving.
// ---------------------------------------------------------------------------

export const RESET_TTL_MINUTES = 30;

let tablePromise: Promise<void> | null = null;
async function ensureResetTable(): Promise<void> {
  if (tablePromise) return tablePromise;
  tablePromise = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS password_resets (
        token_hash text PRIMARY KEY,
        email text NOT NULL,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
    await sql`CREATE INDEX IF NOT EXISTS password_resets_email_idx ON password_resets (email)`;
  })().catch((e) => {
    tablePromise = null;
    throw e;
  });
  return tablePromise;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issue a reset token for `email` and email the link. The caller must NOT
 * branch on the result in a way the user can observe — it is only reported so
 * the action can log accurately.
 */
export async function issueResetToken(
  email: string,
  displayName: string
): Promise<boolean> {
  try {
    await ensureResetTable();
    // Drop this address's older tokens so only the newest link works.
    await sql`DELETE FROM password_resets WHERE email = ${email}`;
    // Opportunistic cleanup of anything long expired.
    await sql`DELETE FROM password_resets WHERE expires_at < now() - interval '1 day'`;

    const token = randomBytes(32).toString("base64url");
    await sql`
      INSERT INTO password_resets (token_hash, email, expires_at)
      VALUES (
        ${hashToken(token)}, ${email},
        now() + (${RESET_TTL_MINUTES} || ' minutes')::interval
      )
    `;

    const link = `${siteUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    return await sendMail({
      to: email,
      subject: "Obnovenie hesla — Pyro & Polomárik",
      text: [
        `Dobrý deň${displayName ? ` ${displayName}` : ""},`,
        "",
        "prišla nám žiadosť o obnovenie hesla k vášmu účtu.",
        "Nové heslo si nastavíte na tomto odkaze:",
        "",
        link,
        "",
        `Odkaz je platný ${RESET_TTL_MINUTES} minút a dá sa použiť iba raz.`,
        "Ak ste o obnovenie hesla nežiadali, tento email pokojne ignorujte —",
        "vaše heslo zostáva nezmenené.",
        "",
        "Pyro & Polomárik",
      ].join("\n"),
    });
  } catch (e) {
    logError("issueResetToken", e);
    return false;
  }
}

/**
 * Redeem a token. Returns the email it was issued for, or null when the token
 * is unknown, already used or expired. The row is deleted as part of the
 * lookup, which is what makes the token single-use even under concurrent
 * requests (only one DELETE can return the row).
 */
export async function consumeResetToken(token: string): Promise<string | null> {
  try {
    await ensureResetTable();
    const rows = (await sql`
      DELETE FROM password_resets
      WHERE token_hash = ${hashToken(token)} AND expires_at > now()
      RETURNING email
    `) as { email: string }[];
    return rows[0]?.email ?? null;
  } catch (e) {
    logError("consumeResetToken", e);
    return null;
  }
}

/** Drop every outstanding token for an address (used after a password change). */
export async function clearResetTokens(email: string): Promise<void> {
  try {
    await ensureResetTable();
    await sql`DELETE FROM password_resets WHERE email = ${email}`;
  } catch {
    // best effort — tokens expire on their own anyway
  }
}
