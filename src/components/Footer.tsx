"use client";

import Link from "next/link";
import { useApp } from "@/lib/store";
import { RESTAURANTS, DAY_NAMES, OPERATOR_COMPANY } from "@/lib/data";
import { Phone, Mail, MapPin, Clock, Flame, Instagram } from "lucide-react";

export function Footer() {
  const restaurantId = useApp((s) => s.restaurantId);
  const r = RESTAURANTS.find((x) => x.id === restaurantId) ?? RESTAURANTS[0];

  return (
    <footer
      className="mt-12 border-t border-white/[0.06] bg-[#0c0c0c] text-neutral-300 lg:!pb-0"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 6rem)" }}
    >
      <div className="section grid gap-10 py-14 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 text-white">
            {/* Brand-coloured flame (emoji can't take the brand colour). */}
            <Flame className="h-6 w-6 text-brand-primary" />
            <span className="font-display text-lg font-extrabold">
              {r.name}
            </span>
          </div>
          <p className="mt-3 text-sm text-neutral-400">{r.tagline}</p>
          <p className="mt-4 text-xs text-neutral-500">
            Prémiová pizza platforma pre dve prevádzky. Rozvoz a osobný odber.
          </p>
          {r.instagram && (
            <a
              href={r.instagram}
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-medium text-neutral-200 transition-colors hover:border-brand-primary/50 hover:text-white"
            >
              <Instagram className="h-4 w-4 text-brand-primary" />
              Instagram
            </a>
          )}
        </div>

        <div>
          <h4 className="mb-3 font-semibold text-white">Navigácia</h4>
          <ul className="space-y-2 text-sm">
            {[
              ["/menu", "Menu"],
              ["/delivery", "Rozvoz"],
              ["/about", "O nás"],
              ["/track", "Sledovať objednávku"],
              ["/account", "Prihlásenie"],
              ["/privacy", "Ochrana súkromia"],
              ["/terms", "Obchodné podmienky"],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="hover:text-white">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-3 font-semibold text-white">Kontakt</h4>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-brand-secondary" /> {r.address}
            </li>
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-brand-secondary" /> {r.phone}
            </li>
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-brand-secondary" /> {r.email}
            </li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 flex items-center gap-2 font-semibold text-white">
            <Clock className="h-4 w-4 text-brand-secondary" /> Otváracie hodiny
          </h4>
          <ul className="space-y-1 text-sm">
            {r.openingHours.map((h) => (
              <li key={h.day} className="flex justify-between">
                <span className="text-neutral-400">{DAY_NAMES[h.day]}</span>
                <span>
                  {h.closed ? "Zatvorené" : `${h.open} – ${h.close}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="section flex flex-col items-center justify-center gap-1 py-5 text-center text-xs text-neutral-500">
          {/* Footer carries the IČO only. The full legal identity (názov,
              DIČ, sídlo, register) stays on the About page. */}
          <span>IČO: {OPERATOR_COMPANY.ico}</span>
          <span>© 2026 Pyro & Polomárik. Všetky práva vyhradené.</span>
        </div>
      </div>
    </footer>
  );
}
