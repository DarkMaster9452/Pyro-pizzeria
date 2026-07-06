import "server-only";
import { sql } from "./db";

export interface DbUser {
  id: string;
  email: string;
  name: string;
  role: "customer" | "admin";
  restaurant_id: string | null;
}

// Verify email + password using pgcrypto's crypt() (bcrypt) inside the DB.
export async function verifyCredentials(
  email: string,
  password: string
): Promise<DbUser | null> {
  const rows = (await sql`
    SELECT id, email, name, role, restaurant_id
    FROM users
    WHERE email = ${email.toLowerCase().trim()}
      AND password_hash = crypt(${password}, password_hash)
    LIMIT 1
  `) as DbUser[];
  return rows[0] ?? null;
}

export interface RegisterResult {
  ok: boolean;
  error?: string;
}

export async function registerUser(
  name: string,
  email: string,
  password: string
): Promise<RegisterResult> {
  const e = email.toLowerCase().trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
    return { ok: false, error: "Neplatný email." };
  if (password.length < 6)
    return { ok: false, error: "Heslo musí mať aspoň 6 znakov." };

  const existing = (await sql`SELECT 1 FROM users WHERE email = ${e} LIMIT 1`) as unknown[];
  if (existing.length) return { ok: false, error: "Účet s týmto emailom už existuje." };

  await sql`
    INSERT INTO users (email, name, password_hash, role)
    VALUES (${e}, ${name.trim() || e}, crypt(${password}, gen_salt('bf')), 'customer')
  `;
  return { ok: true };
}
