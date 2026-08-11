import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Plus_Jakarta_Sans, Anton, Pacifico } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Self-hosted fonts (via next/font) instead of a render-blocking Google Fonts
// <link>: they are inlined/preloaded from our own origin, so the first paint no
// longer waits on a round-trip to fonts.googleapis.com. latin-ext covers the
// Slovak diacritics (á, č, š, ž, ô…).
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});
const anton = Anton({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  variable: "--font-anton",
  display: "swap",
});
const pacifico = Pacifico({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  variable: "--font-pacifico",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Pyro & Polomárik — Pizza platforma",
    template: "%s | Pyro & Polomárik",
  },
  description:
    "Objednajte si prémiovú pizzu z Pyro Pizzeria (Kamenná Poruba) alebo Polomárik (Stráňavy). Rozvoz a osobný odber.",
  keywords: [
    "pizza",
    "rozvoz",
    "Kamenná Poruba",
    "Stráňavy",
    "Pyro Pizzeria",
    "Polomárik",
  ],
  openGraph: {
    title: "Pyro & Polomárik — Pizza platforma",
    description: "Prémiová pizza. Rozvoz a osobný odber.",
    type: "website",
  },
  // No default favicon on purpose: the restaurant-selection screen shows none.
  // Providers sets each pizzeria's own logo as the favicon once one is picked.
  icons: { icon: [] },
};

export const viewport: Viewport = {
  themeColor: "#B22222",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Nonce minted by src/middleware.ts for this response. Next.js applies it to
  // its own scripts automatically; the JSON-LD block below is ours, so it has
  // to carry the nonce itself or the CSP will block it.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="sk"
      className={`dark ${jakarta.variable} ${anton.variable} ${pacifico.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* JSON-LD structured data */}
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Pyro & Polomárik",
              url: "https://pyro-polomarik.sk",
            }),
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
        {/* Vercel Speed Insights — same-origin (/_vercel/…), CSP-compatible. */}
        <SpeedInsights />
      </body>
    </html>
  );
}
