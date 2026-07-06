import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

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
};

export const viewport: Viewport = {
  themeColor: "#B22222",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sk" className="dark" suppressHydrationWarning>
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Poppins:wght@600;700;800&family=Anton&family=Pacifico&display=swap"
          rel="stylesheet"
        />
        {/* JSON-LD structured data */}
        <script
          type="application/ld+json"
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
      </body>
    </html>
  );
}
