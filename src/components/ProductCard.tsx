"use client";

import Image from "next/image";
import { useState } from "react";
import { motion } from "framer-motion";
import type { Product } from "@/lib/types";
import { BadgeRow } from "./Badges";
import { PizzaCustomizer } from "./PizzaCustomizer";
import { useApp } from "@/lib/store";
import { eur, shortId } from "@/lib/utils";
import { Heart, Plus } from "lucide-react";

export function ProductCard({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const favorites = useApp((s) => s.favorites);
  const toggleFavorite = useApp((s) => s.toggleFavorite);
  const addLine = useApp((s) => s.addLine);
  const isFav = favorites.includes(product.id);

  function quickAdd() {
    const size = product.sizes[0];
    addLine({
      lineId: shortId(),
      productId: product.id,
      restaurantId: product.restaurantId,
      name: product.name,
      image: product.image,
      sizeId: size.id,
      sizeLabel: size.label,
      unitPrice: product.basePrice + size.priceDelta,
      quantity: 1,
      extraCheese: false,
      stuffedCrust: false,
      addedIngredients: [],
      removedIngredients: [],
    });
  }

  return (
    <>
      <motion.div
        layout
        whileHover={{ y: -4 }}
        className="group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-card transition-all hover:shadow-soft dark:border dark:border-white/[0.06] dark:bg-[#171313] dark:hover:border-brand-red/30"
      >
        <div className="relative aspect-[4/3] overflow-hidden">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {!product.available && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <span className="rounded-full bg-white px-4 py-1.5 text-sm font-bold text-brand-dark">
                Momentálne nedostupné
              </span>
            </div>
          )}
          <button
            onClick={() => toggleFavorite(product.id)}
            aria-label="Obľúbené"
            className="absolute right-3 top-3 rounded-full bg-white/80 p-2 backdrop-blur transition-transform active:scale-90"
          >
            <Heart
              className={`h-4 w-4 ${
                isFav
                  ? "fill-brand-primary text-brand-primary"
                  : "text-neutral-500"
              }`}
            />
          </button>
          {product.badges.length > 0 && (
            <div className="absolute bottom-3 left-3">
              <BadgeRow badges={product.badges.slice(0, 2)} />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col p-4">
          <h3 className="font-display text-lg font-bold leading-tight">
            {product.name}
          </h3>
          <p className="mt-1 line-clamp-2 flex-1 text-sm text-neutral-500 dark:text-neutral-400">
            {product.description}
          </p>
          {product.allergens.length > 0 && (
            <p className="mt-2 text-[11px] text-neutral-400">
              Alergény: {product.allergens.join(", ")}
            </p>
          )}
          <div className="mt-3 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-neutral-400">
                {product.sizes.length > 1 ? "od" : ""}
              </span>
              <p className="font-display text-xl font-extrabold text-brand-primary">
                {eur(product.basePrice)}
              </p>
            </div>
            {product.category === "pizza" ? (
              <button
                onClick={() => setOpen(true)}
                disabled={!product.available}
                className="btn-primary px-5 py-2.5 text-sm disabled:opacity-40"
              >
                Prispôsobiť
              </button>
            ) : (
              <button
                onClick={quickAdd}
                disabled={!product.available}
                className="btn-primary px-5 py-2.5 text-sm disabled:opacity-40"
              >
                <Plus className="h-4 w-4" /> Pridať
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {open && (
        <PizzaCustomizer product={product} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
