"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useApp } from "@/lib/store";
import { RESTAURANTS } from "@/lib/data";
import { getOpenState, distanceKm } from "@/lib/utils";
import { Clock, MapPin, Navigation, Timer } from "lucide-react";

export function RestaurantModal() {
  const restaurantId = useApp((s) => s.restaurantId);
  const setRestaurant = useApp((s) => s.setRestaurant);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [askedLocation, setAskedLocation] = useState(false);

  const open = restaurantId === null;

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function requestLocation() {
    setAskedLocation(true);
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setCoords(null)
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] overflow-y-auto bg-gradient-to-br from-[#1a0505] via-[#2a0d05] to-[#1a0505]"
        >
          {/* ambient glow */}
          <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-primary/30 blur-[120px]" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-brand-secondary/20 blur-[120px]" />

          <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-4 py-12">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="mb-10 text-center"
            >
              <div className="mb-3 text-5xl">🍕</div>
              <h1 className="font-display text-3xl font-extrabold text-white sm:text-4xl">
                Vyberte si prevádzku
              </h1>
              <p className="mt-2 text-white/60">
                Každá prevádzka má vlastné menu, ceny a rozvozové zóny.
              </p>
              {!askedLocation && (
                <button
                  onClick={requestLocation}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
                >
                  <Navigation className="h-4 w-4" />
                  Povoliť polohu pre vzdialenosť
                </button>
              )}
            </motion.div>

            <div className="grid w-full gap-6 md:grid-cols-2">
              {RESTAURANTS.map((r, i) => {
                const state = getOpenState(r);
                const dist = coords
                  ? distanceKm(coords.lat, coords.lng, r.lat, r.lng)
                  : null;
                return (
                  <motion.button
                    key={r.id}
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.15 + i * 0.1 }}
                    whileHover={{ y: -6 }}
                    onClick={() => setRestaurant(r.id)}
                    className="group overflow-hidden rounded-3xl bg-white text-left shadow-2xl ring-1 ring-white/10"
                  >
                    <div className="relative h-52 overflow-hidden">
                      <Image
                        src={r.image}
                        alt={r.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                        priority={i === 0}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      <div className="absolute left-4 top-4">
                        <span
                          className={`chip ${
                            state.open
                              ? "bg-brand-success text-white"
                              : "bg-brand-error text-white"
                          }`}
                        >
                          <span className="relative flex h-2 w-2">
                            <span
                              className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                                state.open ? "animate-ping bg-white" : ""
                              }`}
                            />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                          </span>
                          {state.label}
                        </span>
                      </div>
                      <div className="absolute bottom-4 left-5 right-5">
                        <h2 className="font-display text-2xl font-extrabold text-white">
                          {r.name}
                        </h2>
                        <p className="text-sm text-white/80">{r.tagline}</p>
                      </div>
                    </div>

                    <div className="space-y-3 p-5">
                      <div className="flex items-start gap-2 text-sm text-neutral-600">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                        <span>
                          {r.address}
                          <br />
                          <span className="font-medium text-neutral-800">
                            {r.city}
                          </span>
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2 rounded-xl bg-brand-bg px-3 py-2 text-neutral-700">
                          <Clock className="h-4 w-4 text-brand-secondary" />
                          {state.open
                            ? `Do ${state.closesAt}`
                            : state.opensAt
                            ? `Otvára ${state.opensAt}`
                            : "Dnes zatvorené"}
                        </div>
                        <div className="flex items-center gap-2 rounded-xl bg-brand-bg px-3 py-2 text-neutral-700">
                          <Timer className="h-4 w-4 text-brand-secondary" />
                          ~{r.prepTimeMinutes} min príprava
                        </div>
                      </div>

                      {dist !== null && (
                        <div className="flex items-center gap-2 text-sm text-neutral-500">
                          <Navigation className="h-4 w-4 text-brand-primary" />
                          Vzdialenosť ~{dist.toFixed(1)} km od vás
                        </div>
                      )}

                      <div className="pt-1">
                        <span className="btn-primary w-full">
                          Vybrať túto prevádzku
                        </span>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <p className="mt-8 text-center text-xs text-white/40">
              Výber môžete kedykoľvek zmeniť v hornom menu.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
