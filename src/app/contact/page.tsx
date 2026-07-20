"use client";

import { useApp } from "@/lib/store";
import { RESTAURANTS, DAY_NAMES } from "@/lib/data";
import { getOpenState } from "@/lib/utils";
import { Footer } from "@/components/Footer";
import { Phone, Mail, MapPin, Clock, Navigation } from "lucide-react";

export default function ContactPage() {
  const restaurantId = useApp((s) => s.restaurantId);
  const r = RESTAURANTS.find((x) => x.id === restaurantId);
  if (!r) return null;
  const state = getOpenState(r);

  return (
    <main className="section py-10">
      <h1 className="font-heading text-4xl uppercase tracking-tight sm:text-5xl">
        Kontakt
      </h1>
      <p className="mt-1 text-neutral-500">
        {r.name} · {r.city}
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="card p-6">
            <h2 className="mb-4 font-display text-lg font-bold">Spojte sa s nami</h2>
            <ul className="space-y-4">
              <li className="flex items-center gap-3">
                <span className="rounded-xl bg-brand-primary/10 p-2.5 text-brand-primary">
                  <Phone className="h-5 w-5" />
                </span>
                <a href={`tel:${r.phone.replace(/[^+\d]/g, "")}`} className="font-semibold hover:text-brand-primary">
                  {r.phone}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <span className="rounded-xl bg-brand-primary/10 p-2.5 text-brand-primary">
                  <Mail className="h-5 w-5" />
                </span>
                <a href={`mailto:${r.email}`} className="font-semibold hover:text-brand-primary">
                  {r.email}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <span className="rounded-xl bg-brand-primary/10 p-2.5 text-brand-primary">
                  <MapPin className="h-5 w-5" />
                </span>
                <span className="font-semibold">{r.address}</span>
              </li>
            </ul>
            <div className="mt-5 flex gap-3">
              <a
                href={`https://maps.google.com/?q=${r.lat},${r.lng}`}
                target="_blank"
                rel="noreferrer"
                className="btn-primary flex-1"
              >
                <Navigation className="h-4 w-4" /> Navigovať
              </a>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold">
              <Clock className="h-5 w-5 text-brand-secondary" /> Otváracie hodiny
              <span
                className={`chip ml-auto ${
                  state.open
                    ? "bg-brand-success/15 text-brand-success"
                    : "bg-brand-error/15 text-brand-error"
                }`}
              >
                {state.label}
              </span>
            </h2>
            <ul className="space-y-1.5 text-sm">
              {r.openingHours.map((h) => (
                <li
                  key={h.day}
                  className="flex justify-between border-b border-dashed border-black/5 py-1 last:border-0 dark:border-white/5"
                >
                  <span className="text-neutral-500">{DAY_NAMES[h.day]}</span>
                  <span className="font-medium">
                    {h.closed ? "Zatvorené" : `${h.open} – ${h.close}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>

        </div>

        {/* map — plain OpenStreetMap embed with a marker (reliable, no JS). */}
        <div className="card overflow-hidden">
          <iframe
            title={`Mapa — ${r.name}`}
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${
              r.lng - 0.008
            }%2C${r.lat - 0.005}%2C${r.lng + 0.008}%2C${
              r.lat + 0.005
            }&layer=mapnik&marker=${r.lat}%2C${r.lng}`}
            className="h-full min-h-[400px] w-full border-0"
            loading="lazy"
          />
        </div>
      </div>
      <Footer />
    </main>
  );
}
