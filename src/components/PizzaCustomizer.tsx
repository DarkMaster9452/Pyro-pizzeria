"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Product } from "@/lib/types";
import { extrasForProduct } from "@/lib/data";
import { useApp } from "@/lib/store";
import { eur, shortId, cn } from "@/lib/utils";
import { BadgeRow } from "./Badges";
import { Check, Minus, Plus, X } from "lucide-react";

export function PizzaCustomizer({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const addLine = useApp((s) => s.addLine);
  const [sizeId, setSizeId] = useState(product.sizes[0].id);
  const [added, setAdded] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");

  const size = product.sizes.find((s) => s.id === sizeId)!;
  const extras = extrasForProduct(product) ?? [];
  const isLangos = product.name.toLowerCase().includes("langoš");
  const hasSizes = product.sizes.length > 1;

  const unitPrice = useMemo(() => {
    let p = product.basePrice + size.priceDelta;
    for (const name of added) {
      const ing = extras.find((i) => i.name === name);
      if (ing) p += ing.price;
    }
    return Math.round(p * 100) / 100;
  }, [product.basePrice, size.priceDelta, added, extras]);

  function toggleAdd(name: string) {
    setAdded((a) =>
      a.includes(name) ? a.filter((x) => x !== name) : [...a, name]
    );
  }

  function add() {
    addLine({
      lineId: shortId(),
      productId: product.id,
      restaurantId: product.restaurantId,
      name: product.name,
      image: product.image,
      sizeId: size.id,
      sizeLabel: size.label,
      unitPrice,
      quantity: qty,
      extraCheese: false,
      stuffedCrust: false,
      addedIngredients: added,
      removedIngredients: [],
      note: note || undefined,
    });
    onClose();
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[95] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-brand-bg sm:rounded-3xl dark:bg-[#1a1a1a]"
        >
          <div className="relative h-44 shrink-0">
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="512px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-brand-dark"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="absolute bottom-4 left-5 right-5">
              <h2 className="font-display text-2xl font-extrabold text-white">
                {product.name}
              </h2>
              <p className="text-sm text-white/80">
                {product.ingredients.join(", ")}
              </p>
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {/* badges (moved off the menu card — readable here on a solid bg) */}
            {product.badges.length > 0 && (
              <BadgeRow badges={product.badges} />
            )}

            {/* size (only when there is a real choice) */}
            {hasSizes && (
              <Section title="Veľkosť">
                <div className="grid grid-cols-3 gap-2">
                  {product.sizes.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSizeId(s.id)}
                      className={cn(
                        "rounded-2xl border-2 p-3 text-center transition-all",
                        sizeId === s.id
                          ? "border-brand-primary bg-brand-primary/5"
                          : "border-transparent bg-white dark:bg-[#262626]"
                      )}
                    >
                      <p className="font-semibold">{s.label}</p>
                      <p className="text-xs text-neutral-500">
                        {s.priceDelta > 0 ? `+${eur(s.priceDelta)}` : "základ"}
                      </p>
                    </button>
                  ))}
                </div>
              </Section>
            )}

            {/* extras (flyer PRÍLOHY / langoš toppings) */}
            {extras.length > 0 && (
              <Section
                title={isLangos ? "S čím to bude? (prílohy)" : "Prílohy"}
              >
                <div className="flex flex-wrap gap-2">
                  {extras.map((ing) => (
                    <button
                      key={ing.name}
                      onClick={() => toggleAdd(ing.name)}
                      className={cn(
                        "chip border transition-colors",
                        added.includes(ing.name)
                          ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                          : "border-black/10 bg-white text-neutral-600 dark:border-white/10 dark:bg-[#262626] dark:text-neutral-300"
                      )}
                    >
                      {added.includes(ing.name) && <Check className="h-3 w-3" />}
                      {ing.name}
                      <span className="text-neutral-400">
                        +{eur(ing.price)}
                      </span>
                    </button>
                  ))}
                </div>
              </Section>
            )}

            {/* note */}
            <Section title="Poznámka pre kuchyňu">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Napr. dobre prepečené, bez cesnaku…"
                className="w-full resize-none rounded-xl border border-black/10 bg-white p-3 text-sm outline-none focus:border-brand-primary dark:border-white/10 dark:bg-[#262626]"
              />
            </Section>
          </div>

          {/* footer */}
          <div className="flex items-center gap-3 border-t border-black/5 bg-white p-4 dark:border-white/10 dark:bg-[#1c1c1c]">
            <div className="flex items-center gap-2 rounded-full bg-brand-bg p-1 dark:bg-[#262626]">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="rounded-full bg-white p-2 shadow-sm dark:bg-[#333]"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-6 text-center font-bold">{qty}</span>
              <button
                onClick={() => setQty((q) => q + 1)}
                className="rounded-full bg-white p-2 shadow-sm dark:bg-[#333]"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button onClick={add} className="btn-primary flex-1">
              Pridať do košíka · {eur(unitPrice * qty)}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-neutral-500">
        {title}
      </h4>
      {children}
    </div>
  );
}
