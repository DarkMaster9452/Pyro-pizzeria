"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useApp } from "@/lib/store";
import { RESTAURANTS, PRODUCTS, REVIEWS } from "@/lib/data";
import { getOpenState, eur, estimatedWait } from "@/lib/utils";
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
  Phone,
  MapPin,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

// Features shown in the hero strip. The delivery estimate is dynamic — it
// tracks the current kitchen load (the same ~wait value shown in the hero
// info row) instead of a fixed "45 min".
function buildFeatures(wait: number) {
  return [
    {
      icon: <Rocket className="h-6 w-6" />,
      t: "Rýchly rozvoz",
      d: `Doručenie ~${wait} min · zadarmo.`,
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
      t: "Chrumkavá pizza",
      d: "Pečená pri vysokej teplote.",
      tint: "bg-brand-secondary/12 text-brand-secondary",
    },
  ];
}

export default function HomePage() {
  const restaurantId = useApp((s) => s.restaurantId);
  const dbProducts = useApp((s) => s.dbProducts);
  const kitchenQueue = useApp((s) => s.kitchenQueue);
  const r = RESTAURANTS.find((x) => x.id === restaurantId);
  if (!r) return null; // selection modal covers screen

  const wait = estimatedWait(r.prepTimeMinutes, kitchenQueue[r.id] ?? 0);
  const popular = (dbProducts ?? PRODUCTS).filter(
    (p) => p.restaurantId === r.id && p.badges.includes("bestseller")
  );
  const reviews = REVIEWS.filter((rev) => rev.restaurantId === r.id);

  return (
    <main>
      <Hero r={r} />
      <FeatureStripSection wait={wait} />
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
  const soldOut = useApp((s) => s.soldOut[r.id] ?? false);
  const queue = useApp((s) => s.kitchenQueue[r.id] ?? 0);
  const dbOpen = useApp((s) => s.dbOpen);
  const state = getOpenState(r);
  const wait = estimatedWait(r.prepTimeMinutes, queue);
  // Customer-facing open state = the admin's manual daily open. Falls back to
  // the opening-hours estimate until the storefront snapshot has loaded.
  const open = dbOpen != null ? (dbOpen[r.id] ?? false) : state.open;
  const canOrder = open && !soldOut;

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
          open
            ? "bg-brand-success/12 text-brand-success"
            : "bg-brand-error/12 text-[#ff6b6b]"
        }`}
      >
        <span className="relative flex h-2 w-2">
          {open && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-success opacity-70" />
          )}
          <span
            className={`relative h-2 w-2 rounded-full ${
              open ? "bg-brand-success" : "bg-[#ff6b6b]"
            }`}
            style={{
              boxShadow: open
                ? "0 0 10px rgba(34,197,94,.8)"
                : "0 0 10px rgba(239,68,68,.8)",
            }}
          />
        </span>
        {open ? "OTVORENÉ" : "ZATVORENÉ"}
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

  const SoldOutBanner = soldOut ? (
    <motion.div
      variants={item}
      className="flex items-start gap-3 rounded-2xl border border-brand-error/30 bg-brand-error/10 px-4 py-3 text-sm text-[#ffb4b4]"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-brand-error" />
      <span>
        <strong className="text-white">Momentálne vypredané.</strong>{" "}
        {r.soldOutNote}
      </span>
    </motion.div>
  ) : null;

  const Headline = (
    <motion.h1
      variants={item}
      className="font-heading text-white"
      style={{ lineHeight: 0.92 }}
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
      Ručne pripravená pizza z kvalitných surovín, pečená do dokonalosti pri
      vysokej teplote. Rozvoz priamo k vám alebo osobný odber — vždy čerstvé,
      vždy poctivé.
    </motion.p>
  );

  const Cta = (
    <motion.div variants={item} className="flex flex-wrap gap-3">
      {canOrder ? (
        <Link
          href="/menu"
          className="inline-flex h-16 items-center gap-3 rounded-full bg-brand-primary px-8 text-lg font-semibold text-white shadow-glow transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-primaryHover hover:shadow-[0_20px_60px_-10px_rgba(233,78,27,0.75)]"
        >
          <Utensils className="h-5 w-5" /> Objednať teraz
          <ArrowRight className="h-5 w-5" />
        </Link>
      ) : (
        <span className="inline-flex h-16 cursor-not-allowed items-center gap-3 rounded-full bg-white/[0.06] px-8 text-lg font-semibold text-white/50">
          {soldOut ? "Vypredané" : "Momentálne zatvorené"}
        </span>
      )}
      <a
        href={`tel:${r.phone.replace(/[^+\d]/g, "")}`}
        className="inline-flex h-16 items-center gap-3 rounded-full border border-white/[0.12] bg-white/[0.04] px-8 text-lg font-semibold text-white backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.08]"
      >
        <Phone className="h-5 w-5 text-brand-accent" /> {r.phone}
      </a>
    </motion.div>
  );

  const Info = (
    <motion.div
      variants={item}
      className="flex flex-wrap gap-x-12 gap-y-4 text-[15px] text-[#B5B5B5]"
    >
      <span className="flex items-center gap-2.5">
        <Clock className="h-[18px] w-[18px] text-brand-accent" /> Príprava ~
        {wait} min
      </span>
      <span className="flex items-center gap-2.5">
        <Truck className="h-[18px] w-[18px] text-brand-accent" /> Rozvoz zadarmo
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
      <div className="relative hidden h-screen min-h-[760px] w-full lg:block">
        <div className="absolute inset-0 bg-[#0d0a08]">
          <Image
            src={r.image}
            alt={`${r.name} — čerstvá pizza`}
            fill
            priority
            sizes="100vw"
            className="object-cover object-[72%_center]"
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
              "linear-gradient(0deg, #090909 4%, rgba(9,9,9,0) 34%), linear-gradient(180deg, rgba(9,9,9,0.55) 0%, rgba(9,9,9,0) 16%)",
          }}
        />
        <Embers />

        <div className="section relative z-10 flex h-full flex-col justify-center pb-40 pt-24">
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="max-w-[620px] space-y-7"
          >
            {Pills}
            {SoldOutBanner}
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
          className="absolute right-[6%] top-[16%] z-10"
        >
          <Seal logo={r.logo} label={r.name} />
        </motion.div>

        {/* feature strip pinned to the bottom of the hero */}
        <div className="section absolute inset-x-0 bottom-6 z-10">
          <FeatureBand wait={wait} />
        </div>
      </div>

      {/* ============ MOBILE ============ */}
      <div className="lg:hidden">
        <div className="relative h-[46vh] min-h-[300px] w-full">
          <Image
            src={r.image}
            alt={`${r.name} — čerstvá pizza`}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#090909] via-[#090909]/20 to-[#090909]/60" />
          <div className="absolute right-5 top-24">
            <Seal className="scale-[0.8]" logo={r.logo} label={r.name} />
          </div>
        </div>
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="section -mt-16 relative z-10 space-y-6 pb-4"
        >
          {Pills}
          {SoldOutBanner}
          {Headline}
          {Paragraph}
          {Cta}
          {Info}
        </motion.div>
      </div>
    </section>
  );
}

function FeatureBand({ wait }: { wait: number }) {
  return (
    <div className="grid grid-cols-3 overflow-hidden rounded-3xl border border-white/[0.08] bg-[#111111]/80 backdrop-blur-md divide-x divide-white/[0.06]">
      {buildFeatures(wait).map((f) => (
        <div key={f.t} className="flex items-center gap-4 p-6">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${f.tint}`}
          >
            {f.icon}
          </div>
          <div>
            <p className="text-lg font-bold text-white">{f.t}</p>
            <p className="text-[14px] text-[#B5B5B5]">{f.d}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* feature strip for mobile (desktop uses the pinned band inside the hero) */
function FeatureStripSection({ wait }: { wait: number }) {
  return (
    <section id="features" className="section pt-10 lg:hidden">
      <div className="grid gap-2 overflow-hidden rounded-3xl border border-white/[0.08] bg-[#111111] sm:grid-cols-3 sm:divide-x sm:divide-white/[0.06]">
        {buildFeatures(wait).map((f) => (
          <div key={f.t} className="flex items-center gap-4 p-6">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${f.tint}`}
            >
              {f.icon}
            </div>
            <div>
              <p className="text-lg font-bold text-white">{f.t}</p>
              <p className="text-[14px] text-[#B5B5B5]">{f.d}</p>
            </div>
          </div>
        ))}
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
          style={{ left: p.l, bottom: "24%", filter: "blur(0.5px)" }}
          animate={{ y: [0, -160], x: [0, p.x, 0], opacity: [0, 0.8, 0] }}
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
