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
  const dbOpen = useApp((s) => s.dbOpen);
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

          <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-4 py-6 sm:py-14">
            <motion.div
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.08 }}
              className="mb-6 text-center sm:mb-10"
            >
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-brand-primary sm:mb-3">
                Vitajte
              </p>
              <h1 className="font-heading text-3xl uppercase tracking-tight text-white sm:text-5xl">
                Vyberte si prevádzku
              </h1>
              <p className="mx-auto mt-3 hidden max-w-md text-[15px] text-white/55 sm:block">
                Každá prevádzka má vlastné menu, ceny a rozvozové zóny.
              </p>
              {!askedLocation && (
                <button
                  onClick={requestLocation}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm text-white/80 backdrop-blur-md transition-colors hover:bg-white/[0.08]"
                >
                  <Navigation className="h-4 w-4 text-brand-primary" />
                  Povoliť polohu pre vzdialenosť
                </button>
              )}
            </motion.div>

            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6">
              {RESTAURANTS.map((r, i) => {
                const state = getOpenState(r);
                // Show the admin's manual daily-open status (falls back to the
                // opening-hours estimate until the snapshot loads).
                const isOpen =
                  dbOpen != null ? (dbOpen[r.id] ?? false) : state.open;
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
                    <div className="relative h-32 overflow-hidden sm:h-44">
                      <Image
                        src={r.image}
                        alt={r.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                        priority={i === 0}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#131313] via-[#131313]/40 to-transparent" />
                      <div className="absolute left-3 top-3 sm:left-4 sm:top-4">
                        <span
                          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-white backdrop-blur-md"
                          style={{
                            backgroundColor: isOpen
                              ? "rgba(34,197,94,0.85)"
                              : "rgba(0,0,0,0.55)",
                          }}
                        >
                          <span className="relative flex h-2 w-2">
                            {isOpen && (
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
                            )}
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                          </span>
                          {isOpen ? "Otvorené" : "Zatvorené"}
                        </span>
                      </div>
                    </div>

                    {/* large round brand logo — overlaps the photo (desktop only;
                        hidden on phones to keep the compact card readable) */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.logo}
                      alt={r.name}
                      className="absolute right-5 top-[148px] z-10 hidden h-24 w-24 rounded-full border-2 border-white/20 object-cover shadow-xl ring-2 ring-black/30 sm:block"
                      style={{ boxShadow: `0 10px 30px -6px ${r.accent}66` }}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display =
                          "none";
                      }}
                    />

                    <div className="space-y-2.5 p-4 sm:space-y-4 sm:p-5">
                      <div className="flex items-center gap-3 sm:block sm:pr-24">
                        {/* Round brand logo inline on phones (the overlapping
                            desktop logo is hidden on mobile). */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={r.logo}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-full border border-white/15 object-cover sm:hidden"
                          style={{ boxShadow: `0 6px 18px -6px ${r.accent}66` }}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                        <div className="min-w-0">
                          <h2 className="font-heading text-xl uppercase tracking-tight text-white sm:text-2xl">
                            {r.name}
                          </h2>
                          <p className="truncate text-sm text-white/50 sm:whitespace-normal">
                            {r.tagline}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 text-sm text-white/70">
                        <MapPin
                          className="mt-0.5 h-4 w-4 shrink-0"
                          style={{ color: r.accent }}
                        />
                        <span>
                          <span className="hidden sm:inline">
                            {r.address}
                            <br />
                          </span>
                          <span className="font-medium text-white/90">
                            {r.city}
                          </span>
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs sm:gap-3 sm:text-sm">
                        <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-2.5 py-2 text-white/70 sm:px-3">
                          <Clock
                            className="h-4 w-4 shrink-0"
                            style={{ color: r.accent }}
                          />
                          {isOpen
                            ? state.open
                              ? `Do ${state.closesAt}`
                              : "Otvorené"
                            : state.opensAt
                            ? `Otvára ${state.opensAt}`
                            : "Dnes zatvorené"}
                        </div>
                        <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-2.5 py-2 text-white/70 sm:px-3">
                          <Timer
                            className="h-4 w-4 shrink-0"
                            style={{ color: r.accent }}
                          />
                          ~{r.prepTimeMinutes} min
                        </div>
                      </div>

                      {dist !== null && (
                        <div className="hidden items-center gap-2 text-sm text-white/50 sm:flex">
                          <Navigation
                            className="h-4 w-4"
                            style={{ color: r.accent }}
                          />
                          Vzdialenosť ~{dist.toFixed(1)} km od vás
                        </div>
                      )}

                      <span
                        className="mt-1 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-[15px] font-semibold text-white transition-transform group-hover:gap-3 sm:py-3"
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

            <p className="mt-6 hidden text-center text-xs text-white/35 sm:mt-8 sm:block">
              Výber môžete kedykoľvek zmeniť v hornom menu.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
