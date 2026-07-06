"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useApp } from "@/lib/store";
import { RESTAURANTS } from "@/lib/data";
import { Footer } from "@/components/Footer";
import { Flame, Heart, Leaf, Award } from "lucide-react";

export default function AboutPage() {
  const restaurantId = useApp((s) => s.restaurantId);
  const r = RESTAURANTS.find((x) => x.id === restaurantId);
  if (!r) return null;

  return (
    <main>
      <section className="section py-12">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <span className="chip bg-brand-primary/10 text-brand-primary">
              O nás
            </span>
            <h1 className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">
              {r.name}
            </h1>
            <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-300">
              {r.tagline} Naša vášeň pre pravú pizzu začína pri výbere surovín a
              končí až vtedy, keď vám horúca pizza dorazí na stôl. Cesto
              pripravujeme denne a necháme ho pomaly kysnúť pre dokonalú chuť a
              chrumkavosť.
            </p>
            <p className="mt-3 text-neutral-500">
              Sídlime v obci {r.city} a doručujeme do okolitých obcí. Okrem pizze
              nájdete v našom menu burgery, cestoviny, šaláty aj dezerty.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-soft"
          >
            <Image src={r.image} alt={r.name} fill className="object-cover" />
          </motion.div>
        </div>
      </section>

      <section className="section pb-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: <Flame />, t: "Pravá pec", d: "Vysoká teplota, dokonalý základ." },
            { icon: <Leaf />, t: "Čerstvé suroviny", d: "Kvalitné a lokálne, kde sa dá." },
            { icon: <Heart />, t: "Domáca pohoda", d: "Recepty s láskou a tradíciou." },
            { icon: <Award />, t: "4.9/5 hodnotenie", d: "Spokojní zákazníci." },
          ].map((v) => (
            <div
              key={v.t}
              className="rounded-2xl bg-white p-6 text-center shadow-card dark:bg-[#1e1e1e]"
            >
              <div className="mx-auto mb-3 inline-flex rounded-2xl bg-brand-primary/10 p-3 text-brand-primary">
                {v.icon}
              </div>
              <p className="font-display font-bold">{v.t}</p>
              <p className="mt-1 text-sm text-neutral-500">{v.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* gallery */}
      <section className="section py-10">
        <h2 className="mb-5 font-display text-2xl font-extrabold">Galéria</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {r.gallery.map((g, i) => (
            <motion.div
              key={g}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="relative aspect-square overflow-hidden rounded-2xl"
            >
              <Image
                src={g}
                alt="Galéria"
                fill
                className="object-cover transition-transform duration-500 hover:scale-110"
              />
            </motion.div>
          ))}
        </div>
      </section>
      <Footer />
    </main>
  );
}
