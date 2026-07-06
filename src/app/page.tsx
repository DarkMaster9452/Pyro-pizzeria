"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useApp } from "@/lib/store";
import { RESTAURANTS, PRODUCTS, CATEGORIES, REVIEWS } from "@/lib/data";
import { getOpenState, eur } from "@/lib/utils";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { Seal } from "@/components/Seal";
import {
  ArrowRight,
  Clock,
  Star,
  Truck,
  ShieldCheck,
  Flame,
  Rocket,
  Utensils,
  Tag,
  MapPin,
  ChevronDown,
} from "lucide-react";

export default function HomePage() {
  const restaurantId = useApp((s) => s.restaurantId);
  const clearRestaurant = useApp((s) => s.clearRestaurant);
  const r = RESTAURANTS.find((x) => x.id === restaurantId);
  if (!r) return null; // modal covers screen

  const state = getOpenState(r);
  const popular = PRODUCTS.filter(
    (p) => p.restaurantId === r.id && p.badges.includes("bestseller")
  );
  const reviews = REVIEWS.filter((rev) => rev.restaurantId === r.id);

  return (
    <main className="dark:text-neutral-100">
      {/* HERO */}
      <section className="relative overflow-hidden">
        {/* subtle embers */}
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <div className="absolute right-[30%] top-24 h-64 w-64 rounded-full bg-brand-red/20 blur-[100px]" />
          <div className="absolute right-0 top-1/3 h-72 w-72 rounded-full bg-brand-secondary/15 blur-[120px]" />
        </div>

        <div className="section relative grid items-center gap-10 py-10 lg:grid-cols-2 lg:py-16">
          {/* left */}
          <div>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <span
                className={`chip px-3.5 py-1.5 ${
                  state.open
                    ? "bg-brand-success/15 text-green-400"
                    : "bg-brand-red/15 text-brand-red"
                }`}
              >
                <span className="relative flex h-2 w-2">
                  {state.open && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  )}
                  <span
                    className={`relative inline-flex h-2 w-2 rounded-full ${
                      state.open ? "bg-green-400" : "bg-brand-red"
                    }`}
                  />
                </span>
                {state.open ? "OTVORENÉ" : "ZATVORENÉ"}
              </span>
              <button
                onClick={clearRestaurant}
                className="chip gap-1.5 border border-white/10 bg-white/5 px-3.5 py-1.5 text-white hover:bg-white/10"
              >
                <MapPin className="h-3.5 w-3.5 text-brand-red" />
                {r.city}
                <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
              </button>
            </div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="font-heading text-6xl uppercase leading-[0.9] tracking-tight text-white sm:text-7xl xl:text-8xl"
            >
              <span className="block">{r.heroLine1}</span>
              <span className="block bg-gradient-to-r from-[#F0473A] to-[#C81E17] bg-clip-text text-transparent">
                {r.heroLine2}
              </span>
            </motion.h1>

            <p className="mt-6 max-w-md text-lg text-neutral-300">
              Ručne pripravená pizza z kvalitných surovín, pečená do dokonalosti
              v našej peci. Rozvoz priamo k vám alebo osobný odber.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/menu"
                className="btn-primary px-7 py-4 text-base uppercase tracking-wide"
              >
                <Utensils className="h-5 w-5" /> Objednať teraz{" "}
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/offers"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-7 py-4 text-base font-semibold uppercase tracking-wide text-white transition-colors hover:bg-white/10"
              >
                <Tag className="h-5 w-5 text-brand-accent" /> Dnešné akcie
              </Link>
            </div>

            <div className="mt-9 flex flex-wrap gap-x-8 gap-y-3 text-[15px] text-neutral-300">
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-brand-accent" /> Príprava ~
                {r.prepTimeMinutes} min
              </span>
              <span className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-brand-accent" /> Rozvoz od{" "}
                {eur(r.deliveryZones[0].minimumOrder)}
              </span>
              <span className="flex items-center gap-2">
                <Star className="h-4 w-4 text-brand-accent" /> 4.9 / 5 hodnotenie
              </span>
            </div>
          </div>

          {/* right — pizza + seal + social proof */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative mx-auto w-full max-w-xl"
          >
            <div className="absolute inset-6 rounded-full bg-brand-red/25 blur-[80px]" />
            <div className="relative aspect-square overflow-hidden rounded-[2rem] border border-white/10 bg-[#1a1414] shadow-2xl">
              <Image
                src={r.image}
                alt={r.name}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            </div>

            <Seal className="absolute -right-2 -top-2 sm:right-4 sm:top-4" />

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="absolute -bottom-4 right-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-brand-ink/85 px-4 py-3 backdrop-blur-md"
            >
              <div className="flex -space-x-2">
                {["from-amber-400 to-orange-500", "from-rose-400 to-red-500", "from-yellow-300 to-amber-500"].map(
                  (g, i) => (
                    <span
                      key={i}
                      className={`h-8 w-8 rounded-full border-2 border-brand-ink bg-gradient-to-br ${g}`}
                    />
                  )
                )}
              </div>
              <div className="text-sm leading-tight">
                <p className="font-bold text-white">Pridajte sa k 5000+</p>
                <p className="text-neutral-400">spokojným zákazníkom ❤️</p>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* scroll indicator */}
        <div className="section relative -mt-2 flex justify-center pb-4">
          <a
            href="#features"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-neutral-300 transition-colors hover:bg-white/10"
            aria-label="Scroll"
          >
            <motion.span
              animate={{ y: [0, 4, 0] }}
              transition={{ repeat: Infinity, duration: 1.6 }}
            >
              <ChevronDown className="h-5 w-5" />
            </motion.span>
          </a>
        </div>
      </section>

      {/* FEATURE STRIP */}
      <section id="features" className="section pb-6">
        <div className="grid gap-2 rounded-[1.75rem] border border-white/[0.06] bg-[#171313] p-6 sm:grid-cols-3 sm:divide-x sm:divide-white/[0.06]">
          {[
            {
              icon: <Rocket className="h-6 w-6" />,
              t: "Rýchly rozvoz",
              d: "Doručenie do 45 minút v zóne A.",
            },
            {
              icon: <ShieldCheck className="h-6 w-6" />,
              t: "Čerstvé suroviny",
              d: "Denne pripravované cesto a omáčky.",
            },
            {
              icon: <Flame className="h-6 w-6" />,
              t: "Pravá pec",
              d: "Pizza pečená pri vysokej teplote.",
            },
          ].map((f) => (
            <div key={f.t} className="flex items-center gap-4 px-2 sm:px-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-red/15 text-brand-red">
                {f.icon}
              </div>
              <div>
                <p className="font-heading text-lg uppercase tracking-wide text-white">
                  {f.t}
                </p>
                <p className="text-sm text-neutral-400">{f.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="section py-14">
        <div className="mb-6">
          <h2 className="font-heading text-3xl uppercase tracking-tight text-white sm:text-4xl">
            Kategórie
          </h2>
          <p className="mt-1 text-neutral-400">Vyberte si, na čo máte chuť.</p>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {CATEGORIES.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
            >
              <Link
                href={`/menu?cat=${c.id}`}
                className="flex flex-col items-center gap-2 rounded-2xl border border-white/[0.06] bg-[#171313] p-4 transition-all hover:-translate-y-1 hover:border-brand-red/40"
              >
                <span className="text-3xl">{c.icon}</span>
                <span className="text-sm font-semibold text-neutral-200">
                  {c.name}
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* POPULAR */}
      <section className="section pb-14">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="font-heading text-3xl uppercase tracking-tight text-white sm:text-4xl">
              Najobľúbenejšie
            </h2>
            <p className="mt-1 text-neutral-400">
              Bestsellery, ktoré si zamilujete.
            </p>
          </div>
          <Link
            href="/menu"
            className="hidden items-center gap-1 font-semibold text-brand-red hover:gap-2 sm:flex"
          >
            Celé menu <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {popular.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* REVIEWS */}
      <section className="relative py-16">
        <div className="section">
          <h2 className="font-heading text-3xl uppercase tracking-tight text-white sm:text-4xl">
            Čo hovoria zákazníci
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {reviews.map((rev) => (
              <div
                key={rev.name}
                className="rounded-2xl border border-white/[0.06] bg-[#171313] p-6"
              >
                <div className="flex items-center gap-1 text-brand-accent">
                  {Array.from({ length: rev.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="mt-3 text-neutral-200">“{rev.text}”</p>
                <div className="mt-4 flex items-center gap-2 text-sm">
                  <span className="font-semibold text-white">{rev.name}</span>
                  {rev.verified && (
                    <span className="chip bg-brand-success/15 text-green-400">
                      <ShieldCheck className="h-3 w-3" /> Overený nákup
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DELIVERY CTA */}
      <section className="section py-10">
        <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#EF4136] to-[#B0170F] p-10 text-white sm:p-14">
          <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10" />
          <div className="relative max-w-xl">
            <h2 className="font-heading text-4xl uppercase tracking-tight">
              Hladní? Objednajte za pár klikov.
            </h2>
            <p className="mt-3 text-white/85">
              Zadajte adresu, overíme dostupnosť rozvozu a doručíme horúcu pizzu
              priamo k vám. Alebo si vyberte osobný odber bez poplatku.
            </p>
            <Link
              href="/menu"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 font-bold text-brand-red"
            >
              Začať objednávku <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
