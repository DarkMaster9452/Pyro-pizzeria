"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useApp } from "@/lib/store";
import { RESTAURANTS } from "@/lib/data";
import { getOpenState, distanceKm } from "@/lib/utils";
import { Clock, MapPin, Navigation, Timer, ArrowRight } from "lucide-react";

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
          className="fixed inset-0 z-[100] overflow-y-auto bg-[#090909]"
        >
          {/* ambient ember glow — matches the site hero */}
          <div className="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-brand-primary/20 blur-[130px]" />
          <div className="pointer-events-none absolute bottom-0 right-10 h-80 w-80 rounded-full bg-brand-accent/10 blur-[130px]" />

          <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-4 py-14">
            <motion.div
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.08 }}
              className="mb-10 text-center"
            >
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-brand-primary">
                Vitajte
              </p>
              <h1 className="font-heading text-4xl uppercase tracking-tight text-white sm:text-5xl">
                Vyberte si prevádzku
              </h1>
              <p className="mx-auto mt-3 max-w-md text-[15px] text-white/55">
                Každá prevádzka má vlastné menu, ceny a rozvozové zóny.
              </p>
              {!askedLocation && (
                <button
                  onClick={requestLocation}
                  className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm text-white/80 backdrop-blur-md transition-colors hover:bg-white/[0.08]"
                >
                  <Navigation className="h-4 w-4 text-brand-primary" />
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
                    initial={{ y: 26, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.14 + i * 0.1 }}
                    whileHover={{ y: -6 }}
                    onClick={() => setRestaurant(r.id)}
                    style={{ ["--accent" as string]: r.accent }}
                    className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#131313] text-left transition-colors hover:border-[var(--accent)]/50"
                  >
                    <div
                      className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-40 blur-3xl transition-opacity group-hover:opacity-70"
                      style={{ background: r.accent }}
                    />
                    <div className="relative h-44 overflow-hidden">
                      <Image
                        src={r.image}
                        alt={r.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                        priority={i === 0}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#131313] via-[#131313]/40 to-transparent" />
                      <div className="absolute left-4 top-4">
                        <span
                          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-white backdrop-blur-md"
                          style={{
                            backgroundColor: state.open
                              ? "rgba(34,197,94,0.85)"
                              : "rgba(0,0,0,0.55)",
                          }}
                        >
                          <span className="relative flex h-2 w-2">
                            {state.open && (
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
                            )}
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                          </span>
                          {state.open ? "Otvorené" : "Zatvorené"}
                        </span>
                      </div>
                      {/* brand logo */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.logo}
                        alt={r.name}
                        className="absolute bottom-3 left-5 h-10 w-auto object-contain drop-shadow-lg"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display =
                            "none";
                        }}
                      />
                    </div>

                    <div className="space-y-4 p-5">
                      <div>
                        <h2 className="font-heading text-2xl uppercase tracking-tight text-white">
                          {r.name}
                        </h2>
                        <p className="text-sm text-white/50">{r.tagline}</p>
                      </div>

                      <div className="flex items-start gap-2 text-sm text-white/70">
                        <MapPin
                          className="mt-0.5 h-4 w-4 shrink-0"
                          style={{ color: r.accent }}
                        />
                        <span>
                          {r.address}
                          <br />
                          <span className="font-medium text-white/90">
                            {r.city}
                          </span>
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-white/70">
                          <Clock
                            className="h-4 w-4"
                            style={{ color: r.accent }}
                          />
                          {state.open
                            ? `Do ${state.closesAt}`
                            : state.opensAt
                            ? `Otvára ${state.opensAt}`
                            : "Dnes zatvorené"}
                        </div>
                        <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-white/70">
                          <Timer
                            className="h-4 w-4"
                            style={{ color: r.accent }}
                          />
                          ~{r.prepTimeMinutes} min
                        </div>
                      </div>

                      {dist !== null && (
                        <div className="flex items-center gap-2 text-sm text-white/50">
                          <Navigation
                            className="h-4 w-4"
                            style={{ color: r.accent }}
                          />
                          Vzdialenosť ~{dist.toFixed(1)} km od vás
                        </div>
                      )}

                      <span
                        className="mt-1 flex w-full items-center justify-center gap-2 rounded-full py-3 text-[15px] font-semibold text-white transition-transform group-hover:gap-3"
                        style={{ backgroundColor: r.accent }}
                      >
                        Vybrať túto prevádzku
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <p className="mt-8 text-center text-xs text-white/35">
              Výber môžete kedykoľvek zmeniť v hornom menu.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
