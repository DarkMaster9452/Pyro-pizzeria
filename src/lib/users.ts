import "server-only";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import { sql } from "./db";

export interface DbUser {
  id: string;
  email: string;
  name: string;
  role:
    | "customer"
    | "employee"
    | "driver"
    | "kuchar"
    | "call"
    | "admin"
    | "super_admin";
  restaurant_id: string | null;
  session_version: number;
}

// OWASP-recommended Argon2id parameters.
const ARGON_OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };
// Dummy hash used to equalise timing when an account does not exist
// (mitigates user-enumeration via response time).
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$CpNy0N164gYlx7dEcWCrqA$Gico5QTgY5ArUqXSrXt+y0C6pXtPA3tX8JT1oG0O07k";

const LOCK_THRESHOLD = 5;
const LOCK_MINUTES = 15;

export async function hashPassword(password: string): Promise<string> {
  return argonHash(password, ARGON_OPTS);
}

// ---------------------------------------------------------------------------
// Demo staff accounts. Created lazily & idempotently so every role can log in
// out of the box (admins, cooks and drivers for both pizzerias). Existing
// accounts are never overwritten. Passwords are for demo only — change them
// before going live.
// ---------------------------------------------------------------------------
interface SeedStaff {
  email: string;
  name: string;
  password: string;
  role: DbUser["role"];
  restaurantId: string | null;
}

export const STAFF_SEED: SeedStaff[] = [
  // Admin accounts are purely administrative — no personal identity/name is
  // stored on them. Login is by email only; the UI shows a generic "Admin".
  { email: "admin@pyro.sk", name: "", password: "admin", role: "admin", restaurantId: "pyro" },
  { email: "admin@polomarik.sk", name: "", password: "admin", role: "admin", restaurantId: "polomarik" },
  { email: "kuchar@pyro.sk", name: "Pyro Kuchár", password: "kuchar", role: "kuchar", restaurantId: "pyro" },
  { email: "kuchar@polomarik.sk", name: "Polomárik Kuchár", password: "kuchar", role: "kuchar", restaurantId: "polomarik" },
  { email: "daniel@pyro.sk", name: "Daniel Pekný", password: "daniel", role: "driver", restaurantId: "pyro" },
  { email: "tomas@pyro.sk", name: "Tomáš Kavecký", password: "tomas", role: "driver", restaurantId: "pyro" },
  { email: "martin@pyro.sk", name: "Martin Straňanek", password: "martin", role: "driver", restaurantId: "pyro" },
  { email: "rozvoz@polomarik.sk", name: "Polomárik Rozvoz", password: "rozvoz", role: "driver", restaurantId: "polomarik" },
  { email: "zakaznik@pyro.sk", name: "Demo Zákazník", password: "zakaznik", role: "customer", restaurantId: null },
  // Call/counter accounts — see only finished orders and call customers. No
  // other admin access.
  { email: "call@pyro.sk", name: "Pyro Telefón", password: "call", role: "call", restaurantId: "pyro" },
  { email: "call@polomarik.sk", name: "Polomárik Telefón", password: "call", role: "call", restaurantId: "polomarik" },
];

let staffSeedPromise: Promise<void> | null = null;
export async function ensureStaffAccounts(): Promise<void> {
  if (staffSeedPromise) return staffSeedPromise;
  staffSeedPromise = (async () => {
    // The role check constraint predates the "kuchar" role — widen it so cook
    // accounts can be created. Idempotent (drop-if-exists, then add).
    await sql`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_chk`.catch(
      () => {}
    );
    await sql`ALTER TABLE users ADD CONSTRAINT users_role_chk CHECK (role IN ('customer','employee','driver','kuchar','call','admin','super_admin'))`.catch(
      () => {}
    );
    // SECURITY: the STAFF_SEED passwords are trivially guessable demo values
    // ("admin", "kuchar", …). Auto-provisioning them on a live deployment would
    // hand an attacker the admin panel via credential guessing. Seed them only
    // outside production, or when an operator explicitly opts in for a one-off
    // bootstrap with SEED_DEMO_STAFF="true" (then rotate the passwords and unset
    // the flag). In production the operator provisions staff with strong,
    // per-account passwords instead. See SECURITY.md.
    const seedDemoStaff =
      process.env.NODE_ENV !== "production" ||
      process.env.SEED_DEMO_STAFF === "true";
    if (seedDemoStaff) {
      for (const s of STAFF_SEED) {
        const e = s.email.toLowerCase();
        const existing = (await sql`
          SELECT 1 FROM users WHERE email = ${e} LIMIT 1
        `) as unknown[];
        if (existing.length) continue; // never overwrite an existing account
        const pwHash = await hashPassword(s.password);
        await sql`
          INSERT INTO users (email, name, password_hash, role, restaurant_id, consent_at)
          VALUES (${e}, ${s.name}, ${pwHash}, ${s.role}, ${s.restaurantId}, now())
          ON CONFLICT (email) DO NOTHING
        `;
      }
    }
    // Strip any personal identity/profile previously stored on admin accounts.
    // Admins are purely administrative: no assigned name and no customer
    // profile (phone/address). This normalises both pre-existing seeds (e.g.
    // "Pyro Admin") and accounts that got a name/phone/address written to them
    // by a checkout while an admin was signed in.
    await sql`
      UPDATE users SET name = '' WHERE role IN ('admin','super_admin') AND name <> ''
    `.catch(() => {});
    await sql`
      UPDATE users SET phone = NULL, address = NULL
      WHERE role IN ('admin','super_admin') AND (phone IS NOT NULL OR address IS NOT NULL)
    `.catch(() => {});
  })().catch((err) => {
    staffSeedPromise = null; // allow a later retry
    throw err;
  });
  return staffSeedPromise;
}

interface UserRow extends DbUser {
  password_hash: string;
  failed_attempts: number;
  locked_until: string | null;
}

// Verify credentials with Argon2id + temporary account lockout after repeated
// failures. Returns the user on success, otherwise null (invalid or locked).
export async function verifyCredentials(
  email: string,
  password: string
): Promise<DbUser | null> {
  const e = email.toLowerCase().trim();
  // Make sure the demo staff accounts exist before the first login. Never let a
  // seeding hiccup block a real login.
  await ensureStaffAccounts().catch((err) =>
    console.error("ensureStaffAccounts failed", err)
  );
  const rows = (await sql`
    SELECT id, email, name, role, restaurant_id, session_version,
           password_hash, failed_attempts, locked_until
    FROM users WHERE email = ${e} LIMIT 1
  `) as UserRow[];
  const row = rows[0];

  if (!row) {
    await argonVerify(DUMMY_HASH, password).catch(() => false);
    return null;
  }
  if (row.locked_until && new Date(row.locked_until) > new Date()) {
    return null;
  }

  let ok = false;
  try {
    ok = await argonVerify(row.password_hash, password);
  } catch {
    ok = false;
  }

  if (ok) {
    if (row.failed_attempts > 0) {
      await sql`UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ${row.id}`;
    }
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      restaurant_id: row.restaurant_id,
      session_version: row.session_version,
    };
  }

  const attempts = row.failed_attempts + 1;
  if (attempts >= LOCK_THRESHOLD) {
    await sql`
      UPDATE users
      SET failed_attempts = ${attempts},
          locked_until = now() + (${LOCK_MINUTES} || ' minutes')::interval
      WHERE id = ${row.id}
    `;
  } else {
    await sql`UPDATE users SET failed_attempts = ${attempts} WHERE id = ${row.id}`;
  }
  return null;
}

export interface RegisterResult {
  ok: boolean;
  error?: string;
  userId?: string;
}

export async function registerUser(
  name: string,
  email: string,
  password: string
): Promise<RegisterResult> {
  const e = email.toLowerCase().trim();
  const existing = (await sql`SELECT 1 FROM users WHERE email = ${e} LIMIT 1`) as unknown[];
  if (existing.length)
    return { ok: false, error: "Účet s týmto emailom už existuje." };

  const pwHash = await hashPassword(password);
  const rows = (await sql`
    INSERT INTO users (email, name, password_hash, role, consent_at)
    VALUES (${e}, ${name.trim() || e}, ${pwHash}, 'customer', now())
    RETURNING id
  `) as { id: string }[];
  return { ok: true, userId: rows[0]?.id };
}

// Look up a user's role by email. Used right after sign-in to decide where to
// redirect, because calling auth() in the same server-action request can return
// a stale (pre-login) session and misroute admins to the customer page.
export async function getRoleByEmail(
  email: string
): Promise<DbUser["role"] | null> {
  const e = email.toLowerCase().trim();
  const rows = (await sql`
    SELECT role FROM users WHERE email = ${e} LIMIT 1
  `) as { role: DbUser["role"] }[];
  return rows[0]?.role ?? null;
}

// Session version check for "logout from all devices" revocation.
export async function getSessionVersion(userId: string): Promise<number | null> {
  const rows = (await sql`
    SELECT session_version FROM users WHERE id = ${userId} LIMIT 1
  `) as { session_version: number }[];
  return rows[0]?.session_version ?? null;
}

export async function bumpSessionVersion(userId: string): Promise<void> {
  await sql`UPDATE users SET session_version = session_version + 1 WHERE id = ${userId}`;
}

export async function deleteAccount(userId: string): Promise<void> {
  // GDPR erasure: an order retains the customer's name / phone / address, so
  // deleting only the users row would orphan that PII in the orders table.
  // Anonymise the customer's past orders first (keep the financial record for
  // accounting, strip the personal data), then remove the account.
  await sql`
    UPDATE orders
    SET customer_name = 'Zmazaný účet', phone = '', email = NULL,
        address = NULL, user_id = NULL
    WHERE user_id = ${userId}
  `.catch(() => {});
  await sql`DELETE FROM users WHERE id = ${userId}`;
}

export async function exportAccount(userId: string) {
  const rows = (await sql`
    SELECT id, email, name, role, restaurant_id, created_at, consent_at
    FROM users WHERE id = ${userId} LIMIT 1
  `) as Record<string, unknown>[];
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Password lifecycle + notification preference
// ---------------------------------------------------------------------------
// Staff passwords must be rotated every 30 days ("primarily admin"). Customers
// may change their password themselves, at most once a week.
export const PASSWORD_MAX_AGE_DAYS = 30;
export const PASSWORD_REMIND_DAYS = 4; // reminder window before the 30d mark
export const CUSTOMER_CHANGE_MIN_DAYS = 7; // customers: once a week

let userSecColsPromise: Promise<void> | null = null;
async function ensureUserSecurityColumns(): Promise<void> {
  if (userSecColsPromise) return userSecColsPromise;
  userSecColsPromise = (async () => {
    // Existing rows get now() as their baseline, so nobody is force-expired the
    // instant this ships — the 30-day clock starts at deploy.
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz NOT NULL DEFAULT now()`;
    // Timestamp of the last *self-service* password change (null until the user
    // actually changes it). The customer once-a-week limit is based on this, so
    // a brand-new customer is never blocked from their first change.
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_pw_change timestamptz`;
    // Email is the only notification channel; opted in by default.
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_opt_in boolean NOT NULL DEFAULT true`;
  })().catch((e) => {
    userSecColsPromise = null;
    throw e;
  });
  return userSecColsPromise;
}

// Days since the user's password was last set (floored). Null if no such user.
export async function getPasswordAgeDays(userId: string): Promise<number | null> {
  await ensureUserSecurityColumns();
  const rows = (await sql`
    SELECT EXTRACT(EPOCH FROM (now() - password_changed_at)) / 86400 AS age
    FROM users WHERE id = ${userId} LIMIT 1
  `) as { age: number | string }[];
  if (rows[0]?.age == null) return null;
  return Math.floor(Number(rows[0].age));
}

export async function isPasswordExpired(userId: string): Promise<boolean> {
  const d = await getPasswordAgeDays(userId);
  return d != null && d >= PASSWORD_MAX_AGE_DAYS;
}

// Verify the current password and set a new one. Enforces the once-a-week limit
// for customers. Bumps session_version so every OTHER device is signed out
// after a password change (the caller re-authenticates).
export async function changeUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  await ensureUserSecurityColumns();
  const rows = (await sql`
    SELECT password_hash, role,
           EXTRACT(EPOCH FROM (now() - last_pw_change)) / 86400 AS since_change
    FROM users WHERE id = ${userId} LIMIT 1
  `) as {
    password_hash: string;
    role: DbUser["role"];
    since_change: number | string | null;
  }[];
  const row = rows[0];
  if (!row) return { ok: false, error: "Účet sa nenašiel." };

  let ok = false;
  try {
    ok = await argonVerify(row.password_hash, currentPassword);
  } catch {
    ok = false;
  }
  if (!ok) return { ok: false, error: "Súčasné heslo je nesprávne." };

  if (newPassword === currentPassword)
    return { ok: false, error: "Nové heslo musí byť iné ako súčasné." };

  // Customer limit: not forced, purely a cap of one change per week. The first
  // change is always allowed (last_pw_change is null until then).
  const sinceChange =
    row.since_change == null ? null : Math.floor(Number(row.since_change));
  if (
    row.role === "customer" &&
    sinceChange != null &&
    sinceChange < CUSTOMER_CHANGE_MIN_DAYS
  ) {
    return {
      ok: false,
      error: "Heslo môžete zmeniť najviac raz za týždeň. Skúste to neskôr.",
    };
  }

  const newHash = await hashPassword(newPassword);
  await sql`
    UPDATE users
    SET password_hash = ${newHash}, password_changed_at = now(),
        last_pw_change = now(), failed_attempts = 0, locked_until = NULL,
        session_version = session_version + 1
    WHERE id = ${userId}
  `;
  return { ok: true };
}

export async function getEmailOptIn(userId: string): Promise<boolean> {
  await ensureUserSecurityColumns();
  const rows = (await sql`
    SELECT email_opt_in FROM users WHERE id = ${userId} LIMIT 1
  `) as { email_opt_in: boolean }[];
  return rows[0]?.email_opt_in ?? true;
}

export async function setEmailOptIn(
  userId: string,
  value: boolean
): Promise<void> {
  await ensureUserSecurityColumns();
  await sql`UPDATE users SET email_opt_in = ${value} WHERE id = ${userId}`;
}
