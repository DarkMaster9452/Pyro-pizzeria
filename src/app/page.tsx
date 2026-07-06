"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useApp } from "@/lib/store";
import { RESTAURANTS, PRODUCTS, CATEGORIES, REVIEWS } from "@/lib/data";
import { getOpenState, eur } from "@/lib/utils";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import {
  ArrowRight,
  Clock,
  Star,
  Truck,
  ShieldCheck,
  Flame,
  Store,
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
    <main>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={r.image}
            alt="Pizza"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-black/85 via-black/60 to-black/30" />
        </div>

        {/* floating ingredients */}
        <motion.div
          className="pointer-events-none absolute right-[8%] top-24 hidden text-6xl md:block"
          animate={{ y: [0, -18, 0], rotate: [0, 8, 0] }}
          transition={{ duration: 6, repeat: Infinity }}
        >
          🍅
        </motion.div>
        <motion.div
          className="pointer-events-none absolute bottom-24 right-[22%] hidden text-5xl md:block"
          animate={{ y: [0, 16, 0], rotate: [0, -10, 0] }}
          transition={{ duration: 7, repeat: Infinity }}
        >
          🌿
        </motion.div>

        <div className="section relative flex min-h-[82vh] flex-col justify-center py-20">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            <div className="mb-4 flex items-center gap-3">
              <span
                className={`chip ${
                  state.open
                    ? "bg-brand-success text-white"
                    : "bg-brand-error text-white"
                }`}
              >
                {state.open ? "🟢 Otvorené" : "🔴 Zatvorené"}
              </span>
              <button
                onClick={clearRestaurant}
                className="chip bg-white/15 text-white backdrop-blur hover:bg-white/25"
              >
                <Store className="h-3 w-3" /> {r.city} · zmeniť
              </button>
            </div>
            <h1 className="font-display text-4xl font-extrabold leading-tight text-white sm:text-6xl">
              {r.name}
              <span className="block bg-gradient-to-r from-brand-accent to-brand-secondary bg-clip-text text-transparent">
                {r.tagline}
              </span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-white/80">
              Ručne pripravená pizza z kvalitných surovín, pečená do dokonalosti.
              Rozvoz priamo k vám alebo osobný odber.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/menu" className="btn-primary px-7 py-3.5 text-base">
                Objednať teraz <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/offers"
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-7 py-3.5 font-semibold text-white backdrop-blur transition-colors hover:bg-white/20"
              >
                <Flame className="h-5 w-5 text-brand-accent" /> Dnešné akcie
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-6 text-sm text-white/80">
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
          </motion.div>
        </div>
      </section>

      {/* FEATURE STRIP */}
      <section className="section -mt-10 relative z-10">
        <div className="grid gap-4 rounded-3xl bg-white p-6 shadow-soft sm:grid-cols-3 dark:bg-[#1e1e1e]">
          {[
            {
              icon: <Truck className="h-6 w-6" />,
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
            <div key={f.t} className="flex items-start gap-4">
              <div className="rounded-2xl bg-brand-primary/10 p-3 text-brand-primary">
                {f.icon}
              </div>
              <div>
                <p className="font-display font-bold">{f.t}</p>
                <p className="text-sm text-neutral-500">{f.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="section py-16">
        <h2 className="font-display text-2xl font-extrabold sm:text-3xl">
          Kategórie
        </h2>
        <p className="mt-1 text-neutral-500">Vyberte si, na čo máte chuť.</p>
        <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
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
                className="flex flex-col items-center gap-2 rounded-2xl bg-white p-4 shadow-card transition-transform hover:-translate-y-1 dark:bg-[#1e1e1e]"
              >
                <span className="text-3xl">{c.icon}</span>
                <span className="text-sm font-semibold">{c.name}</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* POPULAR */}
      <section className="section pb-16">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-extrabold sm:text-3xl">
              Najobľúbenejšie
            </h2>
            <p className="mt-1 text-neutral-500">
              Bestsellery, ktoré si zamilujete.
            </p>
          </div>
          <Link
            href="/menu"
            className="hidden items-center gap-1 font-semibold text-brand-primary hover:gap-2 sm:flex"
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
      <section className="bg-brand-dark py-16 text-white">
        <div className="section">
          <h2 className="font-display text-2xl font-extrabold sm:text-3xl">
            Čo hovoria zákazníci
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {reviews.map((rev) => (
              <div
                key={rev.name}
                className="rounded-2xl bg-white/5 p-6 backdrop-blur ring-1 ring-white/10"
              >
                <div className="flex items-center gap-1 text-brand-accent">
                  {Array.from({ length: rev.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="mt-3 text-white/90">“{rev.text}”</p>
                <div className="mt-4 flex items-center gap-2 text-sm">
                  <span className="font-semibold">{rev.name}</span>
                  {rev.verified && (
                    <span className="chip bg-brand-success/20 text-green-300">
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
      <section className="section py-16">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-primary to-brand-secondary p-10 text-white sm:p-14">
          <div className="max-w-xl">
            <h2 className="font-display text-3xl font-extrabold">
              Hladní? Objednajte za pár klikov.
            </h2>
            <p className="mt-3 text-white/85">
              Zadajte adresu, overíme dostupnosť rozvozu a doručíme horúcu pizzu
              priamo k vám. Alebo si vyberte osobný odber bez poplatku.
            </p>
            <Link
              href="/menu"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 font-bold text-brand-primary"
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
