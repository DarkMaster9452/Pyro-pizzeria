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
import type { Restaurant } from "@/lib/types";
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

const ease = [0.22, 1, 0.36, 1] as const;

export default function HomePage() {
  const restaurantId = useApp((s) => s.restaurantId);
  const r = RESTAURANTS.find((x) => x.id === restaurantId);
  if (!r) return null; // selection modal covers screen

  const popular = PRODUCTS.filter(
    (p) => p.restaurantId === r.id && p.badges.includes("bestseller")
  );
  const reviews = REVIEWS.filter((rev) => rev.restaurantId === r.id);

  return (
    <main>
      <Hero r={r} />
      <FeatureStrip />
      <Categories />
      <Popular popular={popular} />
      <Reviews reviews={reviews} />
      <ClosingCta />
      <Footer />
    </main>
  );
}

/* ----------------------------- HERO ----------------------------- */

function Hero({ r }: { r: Restaurant }) {
  const clearRestaurant = useApp((s) => s.clearRestaurant);
  const state = getOpenState(r);

  const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
  };
  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
  };

  const Pills = (
    <motion.div variants={item} className="flex flex-wrap items-center gap-2.5">
      <span
        className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold ${
          state.open
            ? "bg-brand-success/12 text-brand-success"
            : "bg-brand-error/12 text-[#ff6b6b]"
        }`}
      >
        <span className="relative flex h-2 w-2">
          {state.open && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-success opacity-70" />
          )}
          <span
            className={`relative h-2 w-2 rounded-full ${
              state.open ? "bg-brand-success" : "bg-[#ff6b6b]"
            }`}
            style={{
              boxShadow: state.open
                ? "0 0 10px rgba(34,197,94,.8)"
                : "0 0 10px rgba(239,68,68,.8)",
            }}
          />
        </span>
        {state.open ? "OTVORENÉ" : "ZATVORENÉ"}
      </span>
      <button
        onClick={clearRestaurant}
        className="group inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-3.5 py-2 text-[13px] font-semibold text-white/90 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-white/[0.08]"
      >
        <MapPin className="h-3.5 w-3.5 text-brand-primary" />
        {r.city}
        <ChevronDown className="h-3.5 w-3.5 text-white/40 transition-transform group-hover:translate-y-0.5" />
      </button>
    </motion.div>
  );

  const Headline = (
    <motion.h1
      variants={item}
      className="font-heading text-white"
      style={{ lineHeight: 0.92, letterSpacing: "-0.03em" }}
    >
      <span className="block text-[46px] sm:text-[64px] xl:text-[82px]">
        {r.heroLine1}
      </span>
      <span className="block text-[46px] text-brand-primary sm:text-[64px] xl:text-[82px]">
        {r.heroLine2}
      </span>
    </motion.h1>
  );

  const Paragraph = (
    <motion.p
      variants={item}
      className="max-w-[520px] text-[17px] text-[#B5B5B5] sm:text-lg"
      style={{ lineHeight: 1.7 }}
    >
      Ručne pripravená pizza z kvalitných surovín, pečená do dokonalosti v peci
      na dreve. Rozvoz priamo k vám alebo osobný odber — vždy čerstvé, vždy
      poctivé.
    </motion.p>
  );

  const Cta = (
    <motion.div variants={item} className="flex flex-wrap gap-3">
      <Link
        href="/menu"
        className="inline-flex h-16 items-center gap-3 rounded-full bg-brand-primary px-8 text-lg font-semibold text-white shadow-glow transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-primaryHover hover:shadow-[0_20px_60px_-10px_rgba(233,78,27,0.75)]"
      >
        <Utensils className="h-5 w-5" /> Objednať teraz
        <ArrowRight className="h-5 w-5" />
      </Link>
      <Link
        href="/offers"
        className="inline-flex h-16 items-center gap-3 rounded-full border border-white/[0.12] bg-white/[0.04] px-8 text-lg font-semibold text-white backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.08]"
      >
        <Tag className="h-5 w-5 text-brand-accent" /> Dnešné akcie
      </Link>
    </motion.div>
  );

  const Info = (
    <motion.div
      variants={item}
      className="flex flex-wrap gap-x-12 gap-y-4 text-[15px] text-[#B5B5B5]"
    >
      <span className="flex items-center gap-2.5">
        <Clock className="h-[18px] w-[18px] text-brand-accent" /> Príprava ~
        {r.prepTimeMinutes} min
      </span>
      <span className="flex items-center gap-2.5">
        <Truck className="h-[18px] w-[18px] text-brand-accent" /> Rozvoz od{" "}
        {eur(r.deliveryZones[0].minimumOrder)}
      </span>
      <span className="flex items-center gap-2.5">
        <Star className="h-[18px] w-[18px] fill-brand-accent text-brand-accent" />{" "}
        4.9 / 5 · 5000+ objednávok
      </span>
    </motion.div>
  );

  return (
    <section className="relative -mt-[84px] w-full overflow-hidden">
      {/* ============ DESKTOP ============ */}
      <div className="relative hidden h-screen min-h-[720px] w-full items-center lg:flex">
        <div className="absolute inset-0 bg-[#0d0a08]">
          <Image
            src={r.image}
            alt={`${r.name} — pizza z pece na dreve`}
            fill
            priority
            sizes="100vw"
            className="object-cover object-[70%_center]"
          />
        </div>
        {/* natural fade — solid at left for legible type, pizza stays sharp at right */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, #090909 0%, #090909 30%, rgba(9,9,9,0.72) 48%, rgba(9,9,9,0.18) 66%, rgba(9,9,9,0) 80%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(0deg, #090909 0%, rgba(9,9,9,0) 24%), linear-gradient(180deg, rgba(9,9,9,0.55) 0%, rgba(9,9,9,0) 16%)",
          }}
        />
        <Embers />

        <div className="section relative z-10 w-full">
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="max-w-[600px] space-y-7 pt-16"
          >
            {Pills}
            {Headline}
            {Paragraph}
            {Cta}
            {Info}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8, rotate: -12 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.8, ease, delay: 0.4 }}
          className="absolute right-[7%] top-[22%] z-10"
        >
          <Seal />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease, delay: 0.6 }}
          className="absolute bottom-12 right-[7%] z-10"
        >
          <SocialProof />
        </motion.div>

        <a
          href="#features"
          aria-label="Preskočiť nižšie"
          className="absolute bottom-8 left-1/2 z-10 hidden -translate-x-1/2 text-white/40 transition-colors hover:text-white xl:block"
        >
          <motion.span
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
            className="block"
          >
            <ChevronDown className="h-6 w-6" />
          </motion.span>
        </a>
      </div>

      {/* ============ MOBILE ============ */}
      <div className="lg:hidden">
        <div className="relative h-[46vh] min-h-[300px] w-full">
          <Image
            src={r.image}
            alt={`${r.name} — pizza z pece na dreve`}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#090909] via-[#090909]/20 to-[#090909]/60" />
          <div className="absolute right-5 top-24">
            <Seal className="scale-[0.8]" />
          </div>
        </div>
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="section -mt-16 relative z-10 space-y-6 pb-4"
        >
          {Pills}
          {Headline}
          {Paragraph}
          {Cta}
          {Info}
        </motion.div>
      </div>
    </section>
  );
}

function Embers() {
  const dots = [
    { l: "58%", d: 0, x: 8 },
    { l: "66%", d: 1.2, x: -6 },
    { l: "74%", d: 0.6, x: 10 },
    { l: "82%", d: 2.1, x: -8 },
    { l: "90%", d: 1.6, x: 6 },
    { l: "70%", d: 3, x: 4 },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {dots.map((p, i) => (
        <motion.span
          key={i}
          className="absolute h-1 w-1 rounded-full bg-brand-accent/70"
          style={{ left: p.l, bottom: "20%", filter: "blur(0.5px)" }}
          animate={{
            y: [0, -160],
            x: [0, p.x, 0],
            opacity: [0, 0.8, 0],
          }}
          transition={{
            duration: 6,
            delay: p.d,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}

function SocialProof() {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-white/[0.1] bg-white/[0.05] px-5 py-3.5 backdrop-blur-xl">
      <div className="flex -space-x-2.5">
        {[
          "from-amber-300 to-orange-500",
          "from-rose-400 to-red-500",
          "from-orange-300 to-amber-500",
          "from-red-400 to-rose-600",
        ].map((g, i) => (
          <span
            key={i}
            className={`h-9 w-9 rounded-full border-2 border-[#0e0e0e] bg-gradient-to-br ${g}`}
          />
        ))}
      </div>
      <div className="text-sm leading-tight">
        <p className="font-bold text-white">5000+ zákazníkov</p>
        <p className="text-[#B5B5B5]">nám dôveruje ❤︎</p>
      </div>
    </div>
  );
}

/* ------------------------- FEATURE STRIP ------------------------- */

function FeatureStrip() {
  const features = [
    {
      icon: <Rocket className="h-6 w-6" />,
      t: "Rýchly rozvoz",
      d: "Doručenie do 45 minút v zóne A.",
      tint: "bg-brand-primary/12 text-brand-primary",
    },
    {
      icon: <ShieldCheck className="h-6 w-6" />,
      t: "Čerstvé suroviny",
      d: "Denne pripravované cesto a omáčky.",
      tint: "bg-brand-accent/12 text-brand-accent",
    },
    {
      icon: <Flame className="h-6 w-6" />,
      t: "Pec na dreve",
      d: "Pizza pečená pri vysokej teplote.",
      tint: "bg-brand-secondary/12 text-brand-secondary",
    },
  ];
  return (
    <section id="features" className="section pt-14 lg:pt-20">
      <div className="grid overflow-hidden rounded-3xl border border-white/[0.08] bg-[#111111] sm:grid-cols-3 sm:divide-x sm:divide-white/[0.06]">
        {features.map((f, i) => (
          <motion.div
            key={f.t}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: i * 0.08, ease }}
            className="flex items-center gap-4 p-7"
          >
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${f.tint}`}
            >
              {f.icon}
            </div>
            <div>
              <p className="text-lg font-bold text-white">{f.t}</p>
              <p className="text-[15px] text-[#B5B5B5]">{f.d}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* --------------------------- SECTIONS --------------------------- */

function SectionHead({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-8">
      <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-brand-primary">
        {kicker}
      </p>
      <h2 className="font-heading text-3xl text-white sm:text-[40px]">
        {title}
      </h2>
    </div>
  );
}

function Categories() {
  return (
    <section className="section py-16 lg:py-20">
      <SectionHead kicker="Ponuka" title="Na čo máte chuť?" />
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {CATEGORIES.map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.04, ease }}
          >
            <Link
              href={`/menu?cat=${c.id}`}
              className="flex flex-col items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-[#141414] p-5 transition-all duration-200 hover:-translate-y-1 hover:border-brand-primary/40 hover:bg-[#181818]"
            >
              <span className="text-3xl">{c.icon}</span>
              <span className="text-sm font-semibold text-white/80">
                {c.name}
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Popular({ popular }: { popular: (typeof PRODUCTS)[number][] }) {
  return (
    <section className="section pb-16 lg:pb-20">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-brand-primary">
            Bestsellery
          </p>
          <h2 className="font-heading text-3xl text-white sm:text-[40px]">
            Najobľúbenejšie
          </h2>
        </div>
        <Link
          href="/menu"
          className="group hidden items-center gap-2 text-[15px] font-semibold text-white/70 transition-colors hover:text-white sm:flex"
        >
          Celé menu
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {popular.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}

function Reviews({ reviews }: { reviews: typeof REVIEWS }) {
  return (
    <section className="section pb-16 lg:pb-20">
      <SectionHead kicker="Referencie" title="Čo hovoria zákazníci" />
      <div className="grid gap-6 md:grid-cols-2">
        {reviews.map((rev, i) => (
          <motion.figure
            key={rev.name}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.06, ease }}
            className="rounded-3xl border border-white/[0.08] bg-[#141414] p-8"
          >
            <div className="flex items-center gap-1 text-brand-accent">
              {Array.from({ length: rev.rating }).map((_, j) => (
                <Star key={j} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <blockquote className="mt-4 text-lg leading-relaxed text-white/90">
              “{rev.text}”
            </blockquote>
            <figcaption className="mt-5 flex items-center gap-2 text-sm">
              <span className="font-semibold text-white">{rev.name}</span>
              {rev.verified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-success/12 px-2.5 py-1 text-xs font-semibold text-brand-success">
                  <ShieldCheck className="h-3 w-3" /> Overený nákup
                </span>
              )}
            </figcaption>
          </motion.figure>
        ))}
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="section pb-20">
      <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#111111] px-8 py-14 sm:px-16 sm:py-20">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(233,78,27,0.35), transparent 70%)",
          }}
        />
        <div className="relative max-w-xl">
          <h2 className="font-heading text-4xl leading-[1.05] text-white sm:text-5xl">
            Hlad nepočká.
            <br />
            <span className="text-brand-primary">Objednajte za pár klikov.</span>
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-[#B5B5B5]">
            Zadajte adresu, overíme dostupnosť rozvozu a doručíme horúcu pizzu
            priamo k vám. Alebo si vyberte osobný odber bez poplatku.
          </p>
          <Link
            href="/menu"
            className="mt-8 inline-flex h-14 items-center gap-2.5 rounded-full bg-brand-primary px-8 text-lg font-semibold text-white shadow-glow transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-primaryHover"
          >
            Začať objednávku <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
