"use client";

import Link from "next/link";
import { useApp } from "@/lib/store";
import { RESTAURANTS, DAY_NAMES } from "@/lib/data";
import { Phone, Mail, MapPin, Clock } from "lucide-react";

export function Footer() {
  const restaurantId = useApp((s) => s.restaurantId);
  const r = RESTAURANTS.find((x) => x.id === restaurantId) ?? RESTAURANTS[0];

  return (
    <footer className="mt-20 border-t border-black/5 bg-brand-dark text-neutral-300 dark:border-white/10">
      <div className="section grid gap-10 py-14 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 text-white">
            <span className="text-2xl">🔥</span>
            <span className="font-display text-lg font-extrabold">
              {r.name}
            </span>
          </div>
          <p className="mt-3 text-sm text-neutral-400">{r.tagline}</p>
          <p className="mt-4 text-xs text-neutral-500">
            Prémiová pizza platforma pre dve prevádzky. Rozvoz a osobný odber.
          </p>
        </div>

        <div>
          <h4 className="mb-3 font-semibold text-white">Navigácia</h4>
          <ul className="space-y-2 text-sm">
            {[
              ["/menu", "Menu"],
              ["/offers", "Akcie"],
              ["/delivery", "Rozvoz"],
              ["/about", "O nás"],
              ["/track", "Sledovať objednávku"],
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
        <div className="section flex flex-col items-center justify-between gap-2 py-5 text-xs text-neutral-500 sm:flex-row">
          <span>© 2026 Pyro & Polomárik. Všetky práva vyhradené.</span>
          <span>Vyrobené s 🔥 · Next.js 15 · React 19</span>
        </div>
      </div>
    </footer>
  );
}
