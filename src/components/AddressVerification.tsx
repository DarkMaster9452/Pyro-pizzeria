"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Restaurant, DeliveryZone, CustomerAddress } from "@/lib/types";
import { findZone, eur } from "@/lib/utils";
import { CheckCircle2, XCircle, MapPin, Loader2 } from "lucide-react";

export interface VerifyResult {
  zone: DeliveryZone | null;
  address: CustomerAddress;
  matchedArea?: string;
}

export function AddressVerification({
  restaurant,
  zones,
  onResult,
}: {
  restaurant: Restaurant;
  // optional live zones (from DB); falls back to the restaurant's seed zones
  zones?: DeliveryZone[];
  onResult: (r: VerifyResult) => void;
}) {
  const [address, setAddress] = useState<CustomerAddress>({
    street: "",
    houseNumber: "",
    city: "",
    zip: "",
  });
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);

  function check() {
    if (!address.street && !address.city) return;
    setChecking(true);
    setResult(null);
    // simulate database lookup
    setTimeout(() => {
      const query = `${address.street} ${address.city}`.trim();
      const { zone, matchedArea } = findZone(
        zones ? { ...restaurant, deliveryZones: zones } : restaurant,
        query
      );
      const r = { zone, address, matchedArea };
      setResult(r);
      onResult(r);
      setChecking(false);
    }, 700);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Ulica"
          value={address.street}
          onChange={(v) => setAddress({ ...address, street: v })}
          placeholder="napr. Hlavná / Kamenná Poruba"
          span
        />
        <Field
          label="Číslo domu"
          value={address.houseNumber}
          onChange={(v) => setAddress({ ...address, houseNumber: v })}
          placeholder="215"
        />
        <Field
          label="PSČ"
          value={address.zip}
          onChange={(v) => setAddress({ ...address, zip: v })}
          placeholder="013 14"
        />
        <Field
          label="Obec / mesto"
          value={address.city}
          onChange={(v) => setAddress({ ...address, city: v })}
          placeholder="Kamenná Poruba"
          span
        />
      </div>

      <button
        onClick={check}
        disabled={checking}
        className="btn-ghost w-full"
      >
        {checking ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Overujem adresu…
          </>
        ) : (
          <>
            <MapPin className="h-4 w-4" /> Overiť dostupnosť rozvozu
          </>
        )}
      </button>

      <AnimatePresence mode="wait">
        {result && !checking && (
          <motion.div
            key={result.zone ? "ok" : "no"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {result.zone ? (
              <div className="rounded-2xl border border-brand-success/30 bg-brand-success/5 p-4">
                <div className="flex items-center gap-2 font-semibold text-brand-success">
                  <CheckCircle2 className="h-5 w-5" />
                  Sem doručujeme! ({result.zone.name})
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-center text-sm">
                  <Stat
                    label="Doprava"
                    value={
                      result.zone.deliveryFee === 0
                        ? "Zdarma"
                        : eur(result.zone.deliveryFee)
                    }
                  />
                  <Stat
                    label="Doručenie"
                    value={`~${result.zone.estimatedMinutes} min`}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-brand-error/30 bg-brand-error/5 p-4">
                <div className="flex items-center gap-2 font-semibold text-brand-error">
                  <XCircle className="h-5 w-5" />
                  Žiaľ, na túto adresu nedoručujeme.
                </div>
                <p className="mt-1 text-sm text-neutral-500">
                  Skúste osobný odber alebo si vyberte druhú prevádzku.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  span,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  span?: boolean;
}) {
  return (
    <div className={span ? "col-span-2" : ""}>
      <label className="mb-1 block text-xs font-semibold text-neutral-500">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-primary dark:border-white/10 dark:bg-[#262626]"
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-2 dark:bg-[#262626]">
      <p className="font-bold text-brand-dark dark:text-white">{value}</p>
      <p className="text-[11px] text-neutral-400">{label}</p>
    </div>
  );
}
