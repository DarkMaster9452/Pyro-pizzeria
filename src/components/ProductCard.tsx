"use client";

import Image from "next/image";
import { useState } from "react";
import type { Product } from "@/lib/types";
import { PizzaCustomizer } from "./PizzaCustomizer";
import { useApp } from "@/lib/store";
import { extrasForProduct } from "@/lib/data";
import { eur, shortId } from "@/lib/utils";
import { Plus } from "lucide-react";

export function ProductCard({
  product,
  number,
}: {
  product: Product;
  number?: number;
}) {
  const [open, setOpen] = useState(false);
  const addLine = useApp((s) => s.addLine);
  const soldOut = useApp((s) => s.soldOut[product.restaurantId] ?? false);
  const orderable = product.available && !soldOut;
  const customizable = extrasForProduct(product) != null;

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
      {/* Plain div (no framer-motion layout/hover): the CSS hover lift below is
          enough, and per-card layout animations across the whole grid made the
          menu janky / unresponsive on mobile when filtering or searching. */}
      <div className="group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-lift dark:border dark:border-white/[0.08] dark:bg-[#141414] dark:hover:border-brand-primary/30">
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
                Aktuálne nedostupná
              </span>
            </div>
          )}
          {/* Badges were overlaid here but sat unreadably over busy photos —
              they now show inside the product detail (PizzaCustomizer). */}
        </div>

        <div className="flex flex-1 flex-col p-4">
          <h3 className="font-display text-lg font-bold leading-tight">
            {number != null && (
              <span className="text-brand-primary">{number}. </span>
            )}
            {product.name}
          </h3>
          <p className="mt-1 line-clamp-2 flex-1 text-sm text-neutral-500 dark:text-neutral-400">
            {product.description}
          </p>

          {/* Allergens — shown inline as plain numbers under the description
              (no toggle). */}
          {product.allergens.length > 0 && (
            <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-300">
              Alergény: {product.allergens.join(", ")}
            </p>
          )}

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="text-[11px] text-neutral-400">
                {product.sizes.length > 1 ? "od" : ""}
              </span>
              <p className="font-display text-xl font-extrabold text-brand-primary">
                {eur(product.basePrice)}
              </p>
            </div>
            {!orderable ? (
              <button
                disabled
                className="w-full cursor-not-allowed rounded-full bg-black/5 px-4 py-2.5 text-sm font-semibold text-neutral-400 dark:bg-white/10 dark:text-white/50 sm:w-auto sm:px-5"
              >
                {soldOut ? "Vypredané" : "Nedostupná"}
              </button>
            ) : customizable ? (
              <button
                onClick={() => setOpen(true)}
                className="btn-primary w-full justify-center px-4 py-2.5 text-sm sm:w-auto sm:px-5"
              >
                Prispôsobiť
              </button>
            ) : (
              <button
                onClick={quickAdd}
                className="btn-primary w-full justify-center px-4 py-2.5 text-sm sm:w-auto sm:px-5"
              >
                <Plus className="h-4 w-4" /> Pridať
              </button>
            )}
          </div>
        </div>
      </div>

      {open && (
        <PizzaCustomizer product={product} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
