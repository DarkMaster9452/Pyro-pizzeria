const isProd = process.env.NODE_ENV === "production";

// Content-Security-Policy. Next.js injects a small inline bootstrap script and
// Framer Motion sets inline styles, so 'unsafe-inline' is required unless a
// nonce middleware is added (see SECURITY.md for the nonce upgrade path).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" + (isProd ? "" : " 'unsafe-eval'"),
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://images.unsplash.com https://plus.unsplash.com https://*.basemaps.cartocdn.com",
  "connect-src 'self' https://*.basemaps.cartocdn.com",
  "worker-src 'self' blob:",
  "frame-src 'self' https://www.openstreetmap.org",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
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
