import Link from "next/link";
import { Home, UtensilsCrossed, Phone } from "lucide-react";

export default function NotFound() {
  return (
    <main className="relative flex min-h-[85vh] flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      {/* ambient ember glow — matches the site hero */}
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-brand-primary/15 blur-[130px]" />
      <div className="pointer-events-none absolute bottom-0 right-10 h-72 w-72 rounded-full bg-brand-accent/10 blur-[130px]" />

      <div className="relative flex flex-col items-center">
        <div className="animate-float text-7xl sm:text-8xl">🍕</div>

        <h1 className="mt-6 font-heading text-6xl uppercase tracking-tight text-brand-primary sm:text-8xl">
          404
        </h1>
        <p className="mt-2 text-xl font-bold text-neutral-900 dark:text-white sm:text-2xl">
          Túto stránku sme nenašli
        </p>
        <p className="mt-2 max-w-md text-neutral-500 dark:text-neutral-400">
          Možno bola zjedená, alebo odkaz už neplatí. Nevadí — vráťte sa späť
          a doprajte si niečo z pece.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link href="/" className="btn-primary">
            <Home className="h-4 w-4" />
            Domov
          </Link>
          <Link href="/menu" className="btn-ghost">
            <UtensilsCrossed className="h-4 w-4" />
            Prejsť do menu
          </Link>
          <Link href="/contact" className="btn-ghost">
            <Phone className="h-4 w-4" />
            Kontakt
          </Link>
        </div>
      </div>
    </main>
  );
}
