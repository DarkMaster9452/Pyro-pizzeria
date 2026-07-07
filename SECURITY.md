# Security & Hardening Status

This document maps the production security checklist to what is **implemented
in code** vs. what **requires your configuration** (external services, domain,
secrets) before go-live. Nothing is silently skipped.

Legend: ✅ done in code · ⚙️ needs your config/keys · 📋 documented/next step

---

## Authentication
- ✅ **Argon2id** password hashing (`@node-rs/argon2`, OWASP params) — `src/lib/users.ts`
- ✅ Only password **hashes** stored (never plaintext)
- ✅ Auth.js (NextAuth v5) JWT sessions
- ✅ Cookies: **HttpOnly**, **SameSite=Lax**, **Secure** in production, `__Secure-` prefix — `src/auth.config.ts`
- ✅ **Session expiration** (8h, refresh every 30m)
- ✅ **Logout from all devices** via `session_version` bump — `logoutAllDevicesAction`
- ✅ Session-fixation resistance: JWT issued fresh at login; new session token per login
- ✅ Session revocation enforced in admin actions (`requireAdmin` checks `session_version`)

## Authorization
- ✅ Never trusts the frontend; every admin server action calls `requireAdmin`
- ✅ Verifies authentication, role, and **restaurant ownership** on each admin call
- ✅ Edge middleware + page guard protect `/admin`
- ✅ Roles: `customer`, `employee`, `admin`, `super_admin` (DB CHECK constraint)
- 📋 `employee` role is defined; wire employee-specific views when you add staff accounts

## Input Validation
- ✅ **Zod** validates register, login and order inputs — `src/lib/validation.ts`
- ✅ Rejects malformed forms, params, JSON; returns friendly errors

## SQL Injection
- ✅ All queries are **parameterised** via the Neon serverless tagged-template / `sql.query(text, params)` — no string-built SQL
- 📋 The spec asked for Prisma specifically. The current driver (`@neondatabase/serverless`) is equally injection-safe and works on Vercel + edge. Prisma can be layered later with `@prisma/adapter-neon` if you prefer its DX (migration path unchanged since queries are already parameterised).

## XSS
- ✅ React auto-escapes all rendered content
- ✅ Only one `dangerouslySetInnerHTML` — the static JSON-LD SEO block (no user data)
- ✅ CSP restricts script sources (see headers)

## CSRF
- ✅ Auth.js has built-in CSRF tokens for its auth routes
- ✅ Mutations use **server actions** (same-origin, POST) + **SameSite=Lax** cookies
- ✅ `form-action 'self'` and `frame-ancestors 'none'` in CSP

## Rate Limiting
- ✅ DB-backed limiter on **login, register, order** — `src/lib/security.ts` (`rate_events` table)
- ⚙️ For production scale/edge, add **Upstash Redis** or **Arcjet** (set `UPSTASH_REDIS_REST_URL/TOKEN`) and swap `rateLimit()` internals — interface already abstracts this
- 📋 password-reset / contact / review limiters: add when those endpoints ship

## Account Protection
- ✅ **Temporary lockout** after 5 failed logins (15 min) — `src/lib/users.ts`
- ✅ Timing-equalised login (dummy Argon2 verify) to resist user enumeration
- ⚙️ "New device" login email notifications: needs SMTP (see below)

## Bot Protection / CAPTCHA
- ⚙️ Add CAPTCHA (Cloudflare Turnstile / hCaptcha) on login+register after N failures; set provider keys and verify server-side in the auth actions
- ✅ Lockout + rate limiting already blunt automated abuse

## HTTP Security Headers — `next.config.mjs`
- ✅ Content-Security-Policy
- ✅ Strict-Transport-Security (HSTS, 2y, preload)
- ✅ Referrer-Policy `strict-origin-when-cross-origin`
- ✅ Permissions-Policy (geolocation self; camera/mic/payment off)
- ✅ X-Frame-Options `DENY`
- ✅ X-Content-Type-Options `nosniff`
- 📋 CSP uses `'unsafe-inline'` for scripts (Next bootstrap) — upgrade to a **nonce** via middleware for a stricter policy

## HTTPS
- ⚙️ Vercel serves HTTPS by default and redirects HTTP→HTTPS. HSTS header + `upgrade-insecure-requests` are set. Enable **HSTS preload** submission once on your domain.

## Environment Variables
- ✅ No secrets use `NEXT_PUBLIC_`; all sensitive keys are server-only (`DATABASE_URL`, `AUTH_SECRET`)
- ✅ `.env` git-ignored; `.env.example` documents required vars
- ⚙️ Set `DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST` in Vercel

## Order Security (price integrity)
- ✅ **Server recomputes everything**: line prices from the menu, discounts, delivery fee (from the resolved zone), and total. Client-sent totals are **ignored** — `createOrder` in `src/lib/server-actions.ts`
- ✅ Sold-out and delivery-minimum enforced server-side

## API / Error Handling
- ✅ Actions return friendly messages; internal errors are `console.error`-logged, never leaked
- ✅ Auth/authz + validation on every mutating action
- ⚙️ Wire **Sentry** for private detailed error capture

## Database Security
- ✅ Passwords stored only as Argon2id hashes; no card data stored (no online payments)
- ✅ JWT session tokens are httpOnly cookies, not stored in DB
- ⚙️ Neon: enable/verify automated backups + PITR (Neon retains history; extend retention in console); restrict roles as needed

## Logging / Audit
- ✅ `audit_log` table records: login success/fail/rate-limited, account creation, account deletion/export, order creation, order status changes, sold-out toggles, logout-all
- ✅ Never logs passwords, cookies, JWTs or secrets

## Admin Panel Security
- ✅ All `/admin` routes protected (middleware + page guard + per-action checks)
- ✅ Per-restaurant scoping (admin only sees/acts on their restaurant)
- ✅ Sold-out requires a confirmation dialog
- ✅ Audit logs for admin actions (sold-out, order status)
- 📋 Auto-logout of inactive admins: session maxAge (8h) + `updateAge`; add an idle-timeout client timer if you want a shorter inactivity window
- 📋 Extend audit to product/zone/settings edits once those persist to the DB

## CORS
- ⚙️ Server actions are same-origin by design. If you add public JSON APIs, restrict `Access-Control-Allow-Origin` to your production domain only.

## Password Requirements
- ✅ Min **10 chars**, upper + lower + number (Zod) — enforced on register
- ⚙️ Password reset via email: needs SMTP (Resend/Postmark). Reset tokens must be single-use, hashed, short-TTL. Passwords remain non-recoverable (hash only).

## GDPR
- ✅ Privacy Policy (`/privacy`) and Terms (`/terms`)
- ✅ Cookie consent banner
- ✅ Consent checkbox required at registration (stored as `consent_at`)
- ✅ **Export my data** and **Delete account** in the account page
- 📋 Have the legal texts reviewed and add operator billing details

## Monitoring
- ⚙️ **Sentry** (`@sentry/nextjs`), **Vercel Analytics**, **Speed Insights** — install + set DSN/enable in Vercel

## Pre-deploy checklist
- [x] No secrets committed to Git (`.env` ignored)
- [ ] Production env vars set in Vercel (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST`)
- [x] HTTPS + HSTS (Vercel + headers)
- [x] Rate limiting (DB) — optionally upgrade to Upstash/Arcjet
- [x] CSP + security headers configured
- [x] Admin panel protected
- [x] All actions validated (Zod) + authorized
- [x] Prices recalculated server-side
- [ ] Database backups verified in Neon console
- [ ] Monitoring (Sentry/Vercel Analytics) enabled
- [ ] Change the seeded admin passwords

### Change admin passwords
Generate an Argon2id hash and update the row, e.g. run once locally:
```js
import { hash } from "@node-rs/argon2";
console.log(await hash("YOUR_NEW_PASSWORD", { memoryCost: 19456, timeCost: 2, parallelism: 1 }));
```
Then `UPDATE users SET password_hash = '<hash>', failed_attempts = 0, locked_until = NULL WHERE email = 'admin@pyropizzeria.sk';`
