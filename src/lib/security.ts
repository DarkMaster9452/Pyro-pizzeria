import "server-only";
import { headers } from "next/headers";
import { sql } from "./db";

// Best-effort client identifier (IP) for rate limiting.
export async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0]!.trim();
    return h.get("x-real-ip") ?? "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Fixed-window rate limiter backed by Postgres.
 * Returns true when the action is allowed. Fails open on DB errors so a
 * database blip never locks legitimate users out — production should also
 * enable an edge limiter (Upstash / Arcjet), see SECURITY.md.
 */
export async function rateLimit(
  bucket: string,
  identifier: string,
  max: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const rows = (await sql`
      SELECT COUNT(*)::int AS c FROM rate_events
      WHERE bucket = ${bucket} AND identifier = ${identifier}
        AND created_at > now() - (${windowSeconds} || ' seconds')::interval
    `) as { c: number }[];
    const used = rows[0]?.c ?? 0;
    if (used >= max) return { allowed: false, remaining: 0 };
    await sql`INSERT INTO rate_events (bucket, identifier) VALUES (${bucket}, ${identifier})`;
    return { allowed: true, remaining: Math.max(0, max - used - 1) };
  } catch {
    return { allowed: true, remaining: max };
  }
}

export interface AuditEntry {
  actorId?: string | null;
  actorEmail?: string | null;
  restaurantId?: string | null;
  action: string;
  target?: string | null;
  meta?: Record<string, unknown> | null;
}

// Never log secrets/passwords/tokens — callers must pass only safe metadata.
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await sql`
      INSERT INTO audit_log (actor_id, actor_email, restaurant_id, action, target, meta)
      VALUES (
        ${entry.actorId ?? null}, ${entry.actorEmail ?? null},
        ${entry.restaurantId ?? null}, ${entry.action}, ${entry.target ?? null},
        ${entry.meta ? JSON.stringify(entry.meta) : null}
      )
    `;
  } catch {
    // auditing must never break the request
  }
}
