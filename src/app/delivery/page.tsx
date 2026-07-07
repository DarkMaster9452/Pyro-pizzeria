"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { RESTAURANTS } from "@/lib/data";
import { Footer } from "@/components/Footer";
import {
  AddressVerification,
  type VerifyResult,
} from "@/components/AddressVerification";
import { eur } from "@/lib/utils";
import { Truck, MapPin } from "lucide-react";

export default function DeliveryPage() {
  const restaurantId = useApp((s) => s.restaurantId);
  const dbZones = useApp((s) => s.dbZones);
  const r = RESTAURANTS.find((x) => x.id === restaurantId);
  const [, setResult] = useState<VerifyResult | null>(null);
  if (!r) return null;

  const zones = dbZones?.[r.id] ?? r.deliveryZones;

  return (
    <main className="section py-10">
      <div className="mb-8">
        <span className="chip bg-brand-primary/10 text-brand-primary">
          <Truck className="h-3 w-3" /> Rozvoz
        </span>
        <h1 className="mt-3 font-heading text-4xl uppercase tracking-tight sm:text-5xl">
          Rozvozové <span className="text-brand-red">zóny</span> — {r.city}
        </h1>
        <p className="mt-1 text-neutral-500">
          Overte si, či doručujeme na vašu adresu.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="space-y-4">
          {zones.map((z, i) => (
            <div
              key={z.id}
              className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-card dark:bg-[#1e1e1e]"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-primary/10 font-display text-lg font-extrabold text-brand-primary">
                {String.fromCharCode(65 + i)}
              </div>
              <div className="flex-1">
                <p className="font-display font-bold">{z.name}</p>
                <p className="text-sm text-neutral-500">
                  {z.areas.join(", ")}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold">
                  {z.deliveryFee === 0 ? "doprava zdarma" : `doprava ${eur(z.deliveryFee)}`}
                </p>
                <p className="text-neutral-400">~{z.estimatedMinutes} min</p>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-brand-error/30 p-5 text-brand-error">
            <MapPin className="h-5 w-5" />
            <p className="text-sm">
              Mimo zón — bohužiaľ nedoručujeme. Ponúkame osobný odber.
            </p>
          </div>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <h2 className="mb-4 font-display text-lg font-bold">
              Overte svoju adresu
            </h2>
            <AddressVerification restaurant={r} zones={zones} onResult={setResult} />
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
