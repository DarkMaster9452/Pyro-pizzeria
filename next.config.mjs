// Content-Security-Policy is NOT set here — it is emitted per request by
// src/middleware.ts, which mints a fresh nonce for each response. Setting it in
// both places would send two CSP headers, and the browser enforces the
// intersection, so the nonce policy would be silently narrowed.
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), camera=(), microphone=(), payment=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // Cross-origin isolation. COOP severs the opener relationship so a popup can't
  // reach back into window.opener; CORP stops other origins embedding our
  // documents/resources as no-cors subresources. (COEP is intentionally omitted
  // — require-corp would break the third-party map tiles / Unsplash images.)
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: {
    // Serve AVIF/WebP (much smaller than JPEG) and cache the optimised hero /
    // menu images for a year — the source photos never change, so after the
    // first hit every visitor gets them straight from the edge cache.
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
