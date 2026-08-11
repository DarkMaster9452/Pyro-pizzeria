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

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

// ---------------------------------------------------------------------------
// Rate limiting.
//
// Two interchangeable backends behind one interface:
//
//   * Upstash Redis (preferred) — a single atomic INCR per check, so it stays
//     correct when several serverless instances handle requests concurrently
//     and it keeps this hot path off the primary database.
//   * Postgres (fallback) — always available, no extra service to run.
//
// Upstash is used whenever its two env vars are set; anything unexpected from
// it falls through to the Postgres counter rather than failing the request.
// Both fail OPEN if their store is unreachable: a limiter outage must never
// stop real customers from ordering.
// ---------------------------------------------------------------------------

function upstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

async function upstashRateLimit(
  bucket: string,
  identifier: string,
  max: number,
  windowSeconds: number
): Promise<RateLimitResult | null> {
  // Fixed window: the current window index is part of the key, so the counter
  // expires by itself and no cleanup job is needed.
  const window = Math.floor(Date.now() / 1000 / windowSeconds);
  const key = `rl:${bucket}:${identifier}:${window}`;
  const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, String(windowSeconds)],
    ]),
    cache: "no-store",
  });
  if (!res.ok) return null; // let the caller fall back to Postgres
  const data = (await res.json()) as { result?: unknown }[];
  const used = Number(data?.[0]?.result);
  if (!Number.isFinite(used)) return null;
  // INCR returns the count *including* this attempt, so `used <= max` permits
  // exactly `max` actions per window — the same budget as the SQL branch.
  return { allowed: used <= max, remaining: Math.max(0, max - used) };
}

async function postgresRateLimit(
  bucket: string,
  identifier: string,
  max: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const rows = (await sql`
    SELECT COUNT(*)::int AS c FROM rate_events
    WHERE bucket = ${bucket} AND identifier = ${identifier}
      AND created_at > now() - (${windowSeconds} || ' seconds')::interval
  `) as { c: number }[];
  const used = rows[0]?.c ?? 0;
  if (used >= max) return { allowed: false, remaining: 0 };
  await sql`INSERT INTO rate_events (bucket, identifier) VALUES (${bucket}, ${identifier})`;
  return { allowed: true, remaining: Math.max(0, max - used - 1) };
}

/**
 * Fixed-window rate limiter. Returns `allowed: false` once `max` actions have
 * been taken for this bucket+identifier inside `windowSeconds`.
 */
export async function rateLimit(
  bucket: string,
  identifier: string,
  max: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  if (upstashConfigured()) {
    try {
      const result = await upstashRateLimit(
        bucket,
        identifier,
        max,
        windowSeconds
      );
      if (result) return result;
    } catch {
      // fall through to Postgres
    }
  }
  try {
    return await postgresRateLimit(bucket, identifier, max, windowSeconds);
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
