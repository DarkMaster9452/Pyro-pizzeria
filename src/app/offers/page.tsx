"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useApp } from "@/lib/store";
import { RESTAURANTS } from "@/lib/data";
import { Footer } from "@/components/Footer";
import { Ticket, Clock, Gift, Percent } from "lucide-react";

const CARDS = [
  {
    icon: <Percent className="h-6 w-6" />,
    title: "Happy Hour",
    text: "Každý pracovný deň 14:00–16:00 zľava -5€ na objednávky nad 25€.",
    tag: "HAPPY5",
    gradient: "from-brand-primary to-brand-secondary",
  },
  {
    icon: <Gift className="h-6 w-6" />,
    title: "Doprava zdarma",
    text: "Pri objednávke nad 20€ dovezieme zdarma v rámci zóny.",
    tag: "FREEDELIVERY",
    gradient: "from-brand-secondary to-brand-accent",
  },
  {
    icon: <Ticket className="h-6 w-6" />,
    title: "Vernostná -10%",
    text: "Zľava -10% pre stálych zákazníkov na objednávky nad 15€.",
    tag: "PYRO10",
    gradient: "from-brand-accent to-brand-primary",
  },
];

export default function OffersPage() {
  const restaurantId = useApp((s) => s.restaurantId);
  const dbCoupons = useApp((s) => s.dbCoupons);
  const r = RESTAURANTS.find((x) => x.id === restaurantId);

  // Only real, currently-active coupons (from the admin/DB) — filtered to this
  // pizzeria. Before the storefront snapshot loads, dbCoupons is null; show
  // nothing rather than stale demo coupons.
  const coupons = (dbCoupons ?? []).filter(
    (c) => c.restaurantId === "all" || c.restaurantId === restaurantId
  );
  const activeCodes = new Set(coupons.map((c) => c.code));
  // Marketing cards only make sense while their promo code actually exists.
  const cards = CARDS.filter((c) => activeCodes.has(c.tag));

  if (!r) return null;

  return (
    <main className="section py-10">
      <div className="mb-8">
        <h1 className="font-heading text-4xl uppercase tracking-tight sm:text-5xl">
          Špeciálne <span className="text-brand-red">akcie</span>
        </h1>
        <p className="mt-1 text-neutral-500">
          Aktuálne zľavy a kupóny pre {r.name}.
        </p>
      </div>

      {cards.length > 0 && (
      <div className="grid gap-5 md:grid-cols-3">
        {cards.map((c, i) => (
          <motion.div
            key={c.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${c.gradient} p-7 text-white`}
          >
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
            <div className="mb-4 inline-flex rounded-2xl bg-white/20 p-3">
              {c.icon}
            </div>
            <h3 className="font-display text-xl font-extrabold">{c.title}</h3>
            <p className="mt-2 text-sm text-white/85">{c.text}</p>
            <div className="mt-5 flex items-center gap-2">
              <span className="rounded-lg border border-dashed border-white/50 bg-white/10 px-3 py-1 font-mono text-sm font-bold">
                {c.tag}
              </span>
              <span className="text-xs text-white/70">skopírujte do košíka</span>
            </div>
          </motion.div>
        ))}
      </div>
      )}

      {/* buy 2 get 1 banner */}
      <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-3xl bg-brand-dark p-8 text-white sm:flex-row">
        <div className="flex items-center gap-4">
          <span className="text-4xl">🍕🍕</span>
          <div>
            <h3 className="font-display text-xl font-extrabold">
              Kúp 2, tretiu máš zdarma
            </h3>
            <p className="text-sm text-white/70">
              Platí na vybrané pizze každú nedeľu.
            </p>
          </div>
        </div>
        <Link href="/menu" className="btn-primary">
          Objednať
        </Link>
      </div>

      {coupons.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold">
            <Clock className="h-5 w-5 text-brand-secondary" /> Všetky dostupné
            kupóny
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {coupons.map((c) => (
              <div
                key={c.code}
                className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-card dark:bg-[#1e1e1e]"
              >
                <div>
                  <p className="font-mono font-bold text-brand-primary">
                    {c.code}
                  </p>
                  <p className="text-sm text-neutral-500">{c.label}</p>
                </div>
                <span className="chip bg-brand-primary/10 text-brand-primary">
                  od {c.minSubtotal}€
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <Footer />
    </main>
  );
}
