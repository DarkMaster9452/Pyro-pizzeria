import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

const isDev = process.env.NODE_ENV !== "production";

// ---------------------------------------------------------------------------
// Content-Security-Policy with a per-request nonce.
//
// The policy lives here rather than in next.config.mjs because a nonce has to
// be freshly generated for every response. Next.js picks the nonce up from the
// Content-Security-Policy request header we set below and stamps it onto its
// own bootstrap scripts; the root layout reads `x-nonce` for the one inline
// script we write by hand (the JSON-LD block).
//
// 'strict-dynamic' means: trust scripts the nonce'd bundle itself loads, and
// ignore host allowlists. That is what lets the Turnstile widget pull in its
// own code without opening script-src to a whole origin. 'unsafe-inline' is
// kept only as the CSP Level 2 fallback — any browser that understands nonces
// ignores it, which is the entire point of the upgrade.
//
// Trade-off worth knowing: a per-request nonce means pages are rendered
// dynamically rather than served from the static prerender cache.
// ---------------------------------------------------------------------------
function buildCsp(nonce: string): string {
  const turnstile = "https://challenges.cloudflare.com";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' ${turnstile}${
      isDev ? " 'unsafe-eval'" : ""
    }`,
    // Framer Motion animates via inline styles and next/font inlines its
    // @font-face block, so styles stay permissive. Far lower risk than script.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://images.unsplash.com https://plus.unsplash.com https://*.basemaps.cartocdn.com",
    `connect-src 'self' https://*.basemaps.cartocdn.com ${turnstile}`,
    "worker-src 'self' blob:",
    `frame-src 'self' https://www.openstreetmap.org ${turnstile}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

function makeNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

// The `authorized` callback in auth.config.ts guards /admin, /rozvoz, /kuchyna
// and /call; it returns true for everything else, so widening the matcher to
// the whole site only adds the CSP work.
export default NextAuth(authConfig).auth((req) => {
  const nonce = makeNonce();
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
});

export const config = {
  matcher: [
    // Every page route. Excluded: /api (Auth.js owns its own routes and JSON
    // responses have no scripts to protect), Next's static output, and plain
    // asset files — those are immutable and carry no scripts, so running a
    // per-request nonce over them would only defeat their caching.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|txt|xml|webmanifest)$).*)",
  ],
};
