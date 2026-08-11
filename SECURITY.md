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
- ✅ Limiter on **login, register, order, order status/cancel, password change** — `src/lib/security.ts`
- ✅ **Password-reset limiters**: per IP (5/h) *and* per email address (3/h), so one host can't spray and many hosts can't mailbomb one victim; redemption attempts capped at 10/h per IP
- ✅ **Upstash Redis backend** — used automatically when `UPSTASH_REDIS_REST_URL/TOKEN` are set (atomic `INCR`, off the primary database), falling back to the Postgres `rate_events` counter on any error
- ✅ Both backends fail **open** if their store is unreachable: a limiter outage must never stop real customers ordering
- 📋 contact / review limiters: add when those endpoints ship (the contact page is currently static — no form)

## Account Protection
- ✅ **Temporary lockout** after 5 failed logins (15 min) — `src/lib/users.ts`
- ✅ Timing-equalised login (dummy Argon2 verify) to resist user enumeration
- ✅ **"New device" login email** — a hashed User-Agent fingerprint per account (`known_devices`); the first login from an unseen browser emails the owner. Honours the account's `email_opt_in`; the account's very first device is recorded silently. Needs the mail vars below to actually send — `src/lib/devices.ts`
  - The fingerprint deliberately excludes the IP: phones roam constantly, and an IP-sensitive fingerprint would bury real warnings in false alarms.

## Bot Protection / CAPTCHA
- ✅ **Cloudflare Turnstile** on **login, registration, order creation and password-reset requests** — verified server-side in `src/lib/captcha.ts`, widget in `src/components/Captcha.tsx`
- ⚙️ Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` to switch it on. With them unset the widget is not rendered and the check is skipped, so local dev and previews keep working
- ✅ Fails **closed** on an explicit "not a human" verdict, **open** if Cloudflare itself is unreachable (the per-IP limits still apply underneath)
- ✅ Lockout + rate limiting blunt automated abuse even without it

## HTTP Security Headers — `src/middleware.ts` (CSP) + `next.config.mjs` (the rest)
- ✅ **Content-Security-Policy with a per-request nonce** — `script-src` is `'nonce-…' 'strict-dynamic'`; `'unsafe-inline'` remains only as the CSP Level 2 fallback that nonce-aware browsers ignore. Next.js picks the nonce off the request header for its own bootstrap; the root layout stamps it on the one hand-written inline script (JSON-LD)
  - Trade-off: a per-request nonce means pages render dynamically instead of being served from the static prerender cache. Unavoidable — Next.js only injects the nonce on a dynamic render.
  - The CSP is emitted **only** from middleware. Do not also set it in `next.config.mjs`: two CSP headers are enforced as their intersection, which would silently break the nonce.
- ✅ `style-src` keeps `'unsafe-inline'` — Framer Motion animates via inline styles and `next/font` inlines its `@font-face` block. Much lower risk than script.
- ✅ Strict-Transport-Security (HSTS, 2y, preload)
- ✅ Referrer-Policy `strict-origin-when-cross-origin`
- ✅ Permissions-Policy (geolocation self; camera/mic/payment off)
- ✅ X-Frame-Options `DENY`
- ✅ X-Content-Type-Options `nosniff`

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
- ✅ Product create/edit/delete, availability toggles, coupon and delivery-zone edits, tips, shift and owner changes
- ✅ Password reset: requested / rate-limited / unknown-address / completed
- ✅ Never logs passwords, cookies, JWTs, reset tokens or secrets

## Admin Panel Security
- ✅ All `/admin` routes protected (middleware + page guard + per-action checks)
- ✅ Per-restaurant scoping (admin only sees/acts on their restaurant)
- ✅ Sold-out requires a confirmation dialog
- ✅ Audit logs for admin actions (sold-out, order status, menu, coupons, zones)
- ✅ **Idle auto-logout after 30 min** with a 60-second countdown warning — `src/components/IdleTimeout.tsx`, mounted on `/admin` only. The kitchen / dispatch / counter boards are intentionally excluded: they are watched passively for long stretches of a shift and hold no admin rights.

## CORS
- ⚙️ Server actions are same-origin by design. If you add public JSON APIs, restrict `Access-Control-Allow-Origin` to your production domain only.

## Staff account seeding (production safety)
- ✅ Staff accounts (`admin@…`, `kuchar@…`, drivers, call) are created once with a shared bootstrap password whose default **is published in this repository**. In production no staff account is created unless the deployment opts in with `STAFF_BOOTSTRAP_PASSWORD` (preferred) or `SEED_DEMO_STAFF="true"` — `src/lib/users.ts`
- ✅ Existing accounts are never overwritten, so turning seeding off cannot lock an existing deployment out. Schema migrations still run either way.
- ✅ A staff login using the in-source bootstrap password logs a loud warning on every sign-in, so the state cannot stay unnoticed
- ⚠️ **This does not retro-fix an account already seeded with the weak password.** If this deployment has been live with the default, change every staff password now (recipe at the end of this file). Anyone reading this repository can otherwise sign in as an admin.

## Order tracking / IDOR
- ✅ `getOrderStatus` no longer treats the sequential order id as a bearer secret — it requires the per-order **cancel token**, order **ownership**, or a **same-restaurant staff** session, and is IP rate-limited (anti-enumeration) — `src/lib/server-actions.ts`
- ✅ `cancelOrder` is IP rate-limited so the UUID cancel token can't be brute-forced

## Privacy / GDPR erasure
- ✅ Deleting an account **anonymises the customer's past orders** (name/phone/email/address stripped, `user_id` nulled) so no PII is orphaned in `orders` — `deleteAccount` in `src/lib/users.ts`

## Password Requirements
- ✅ Min **10 chars**, max **128 chars** (Argon2 DoS guard), upper + lower + number (Zod) — enforced on register **and on reset**
- ✅ **Password reset by email** — `/forgot-password` → `/reset-password`, implemented in `src/lib/password-reset.ts`:
  - 256-bit random token, only its **SHA-256 hash** is stored, so a database leak yields no working links
  - **30-minute TTL** and **single use** — redeeming is a `DELETE … RETURNING`, which stays single-use even under concurrent requests
  - Requesting a reset answers **identically for known and unknown addresses**, so it cannot enumerate customers
  - Completing one revokes every existing session (`session_version` bump) and clears any failed-login lockout
  - Recovery deliberately does **not** consume the customer's "one voluntary change per week" allowance
  - Passwords remain non-recoverable (hash only)
- ⚙️ Needs `RESEND_API_KEY` + `MAIL_FROM` + `NEXT_PUBLIC_SITE_URL`. **Without them no reset email is sent** (a warning is logged and the user still sees the neutral "if an account exists…" message)

## GDPR
- ✅ Privacy Policy (`/privacy`) and Terms (`/terms`)
- ✅ Cookie consent banner
- ✅ Consent checkbox required at registration (stored as `consent_at`)
- ✅ **Export my data** and **Delete account** in the account page
- ✅ Operator billing details published (LAJ, s.r.o. — in "O nás" and the footer)
- 📋 Have the legal texts reviewed by a lawyer

## Monitoring
- ⚙️ **Sentry** (`@sentry/nextjs`), **Vercel Analytics**, **Speed Insights** — install + set DSN/enable in Vercel

## Pre-deploy checklist

Done in code — nothing left to do:
- [x] No secrets committed to Git (`.env` ignored)
- [x] HTTPS + HSTS (Vercel + headers)
- [x] Rate limiting, with an Upstash backend available
- [x] Nonce-based CSP + security headers
- [x] Admin panel protected + idle auto-logout
- [x] All actions validated (Zod) + authorized
- [x] Prices recalculated server-side
- [x] CAPTCHA on login / register / order / password reset
- [x] Password reset by email
- [x] New-device login alerts
- [x] Staff seeding refused in production without an explicit opt-in

Needs someone with access to the accounts — cannot be done from the repository:
- [ ] **Change every staff password** (see below) — the in-source bootstrap password is public
- [ ] Production env vars in Vercel: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST`, `NEXT_PUBLIC_SITE_URL`
- [ ] Turnstile keys in Vercel (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`) — without them the CAPTCHA is inert
- [ ] Mail keys in Vercel (`RESEND_API_KEY`, `MAIL_FROM`) — without them password reset cannot deliver
- [ ] Database backups / PITR verified in the Neon console
- [ ] Monitoring (Sentry DSN / Vercel Analytics) enabled
- [ ] HSTS preload submission for the live domain
- [ ] Legal texts reviewed by a lawyer

### Change the staff passwords

Do this for **every** account in `STAFF_SEED` (`src/lib/users.ts`), not just the
admins: `admin@pyro.sk`, `admin@polomarik.sk`, `kuchar@pyro.sk`,
`kuchar@polomarik.sk`, `daniel@pyro.sk`, `tomas@pyro.sk`, `martin@pyro.sk`,
`rozvoz@polomarik.sk`, `call@pyro.sk`, `call@polomarik.sk`.

The simplest route is to sign in to each account and use the in-app password
change. To do it directly in the database instead, generate an Argon2id hash
locally:

```js
import { hash } from "@node-rs/argon2";
console.log(await hash("YOUR_NEW_PASSWORD", { memoryCost: 19456, timeCost: 2, parallelism: 1 }));
```

then, per account:

```sql
UPDATE users
SET password_hash = '<hash>', failed_attempts = 0, locked_until = NULL,
    password_changed_at = now(), session_version = session_version + 1
WHERE email = 'admin@pyro.sk';
```

Bumping `session_version` signs out any session already open on that account —
which is the point if the old password may have leaked.
