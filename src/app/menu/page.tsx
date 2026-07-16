"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/lib/store";
import { PRODUCTS, CATEGORIES } from "@/lib/data";
import type { Badge, CategoryId } from "@/lib/types";
import { ProductCard } from "@/components/ProductCard";
import { cn, pizzaNumbers } from "@/lib/utils";
import {
  Search,
  SlidersHorizontal,
  Pizza,
  Beef,
  Sandwich,
  Drumstick,
  Droplets,
  UtensilsCrossed,
  ArrowDownUp,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";

const FILTERS: { id: Badge; label: string }[] = [
  { id: "vegetarian", label: "Vegetariánske" },
  { id: "spicy", label: "Pikantné" },
  { id: "new", label: "Novinky" },
  { id: "bestseller", label: "Populárne" },
];

// "Všetko" is a virtual category shown first and selected by default.
const CATEGORY_TABS: { id: CategoryId | "all"; name: string }[] = [
  { id: "all", name: "Všetko" },
  ...CATEGORIES.map((c) => ({ id: c.id, name: c.name })),
];

// Clean monochrome line icons for the category tabs (inherit the text colour).
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  all: UtensilsCrossed,
  pizza: Pizza,
  burgers: Beef,
  sandwiches: Sandwich,
  sides: Drumstick,
  sauces: Droplets,
};

function MenuInner() {
  const params = useSearchParams();
  const restaurantId = useApp((s) => s.restaurantId);
  const dbProducts = useApp((s) => s.dbProducts);
  const initialCat = (params.get("cat") as CategoryId | "all") || "all";
  const [activeCat, setActiveCat] = useState<CategoryId | "all">(initialCat);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Badge[]>([]);
  const [sort, setSort] = useState<"default" | "price-asc" | "price-desc">(
    "default"
  );

  const source = dbProducts ?? PRODUCTS;
  // Flyer numbers, computed from the canonical (unsorted) list so they stay
  // fixed even when the customer sorts by price.
  const numberMap = useMemo(
    () => pizzaNumbers(source, restaurantId),
    [source, restaurantId]
  );
  const products = useMemo(() => {
    let list = source.filter(
      (p) =>
        p.restaurantId === restaurantId &&
        (activeCat === "all" || p.category === activeCat)
    );
    if (query) {
      const q = query.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.ingredients.some((i) => i.toLowerCase().includes(q)) ||
          // Match the flyer number too (e.g. type "12" to find pizza #12).
          (numberMap[p.id] != null && String(numberMap[p.id]).startsWith(q))
      );
    }
    if (filters.length) {
      list = list.filter((p) => filters.every((f) => p.badges.includes(f)));
    }
    if (sort === "price-asc") list = [...list].sort((a, b) => a.basePrice - b.basePrice);
    if (sort === "price-desc") list = [...list].sort((a, b) => b.basePrice - a.basePrice);
    return list;
  }, [source, restaurantId, activeCat, query, filters, sort, numberMap]);

  if (!restaurantId) return null;

  function toggleFilter(f: Badge) {
    setFilters((cur) =>
      cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]
    );
  }

  return (
    <main>
      {/* header */}
      <div className="section pt-10">
        <h1 className="font-heading text-4xl uppercase tracking-tight sm:text-5xl">
          Naše <span className="text-brand-red">Menu</span>
        </h1>
        <p className="mt-1 text-neutral-500 dark:text-neutral-400">
          Vyberte kategóriu a prispôsobte si objednávku.
        </p>
      </div>

      {/* sticky category + search */}
      <div className="sticky top-[72px] z-30 mt-4 border-y border-black/5 bg-brand-bg/90 backdrop-blur-xl dark:border-white/[0.06] dark:bg-brand-ink/85">
        <div className="section flex flex-col gap-3 py-3">
          <div className="flex items-center gap-3">
            <div className="flex flex-1 items-center gap-2 rounded-full bg-white px-4 shadow-sm dark:bg-[#242424]">
              <Search className="h-4 w-4 text-neutral-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Hľadať v menu alebo číslo…"
                className="w-full bg-transparent py-2.5 text-sm outline-none"
              />
            </div>
            <div className="relative shrink-0">
              <ArrowDownUp className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-primary" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                aria-label="Zoradiť"
                className="w-[104px] cursor-pointer appearance-none rounded-full border border-black/10 bg-white py-2.5 pl-9 pr-8 text-sm font-semibold text-neutral-700 shadow-sm outline-none transition-colors hover:border-brand-primary/40 focus:border-brand-primary dark:border-white/10 dark:bg-[#242424] dark:text-neutral-200"
              >
                <option value="default">Zoradiť</option>
                <option value="price-asc">Cena ↑</option>
                <option value="price-desc">Cena ↓</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            </div>
          </div>

          {/* categories — horizontal scroll; a right-edge fade hints there are
              more so the next one peeks in when "Všetko" is selected */}
          <div className="relative -mx-4">
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pr-10">
              {CATEGORY_TABS.map((c) => {
                const Icon = CATEGORY_ICONS[c.id] ?? UtensilsCrossed;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveCat(c.id)}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                      activeCat === c.id
                        ? "bg-brand-primary text-white shadow-glow"
                        : "bg-white text-neutral-600 dark:bg-[#242424] dark:text-neutral-300"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {c.name}
                  </button>
                );
              })}
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-brand-bg to-transparent dark:from-brand-ink" />
          </div>

          {/* filters — single scrollable row so they never wrap to 2 lines */}
          <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4">
            <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-neutral-400">
              <SlidersHorizontal className="h-3 w-3" /> Filtre
            </span>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => toggleFilter(f.id)}
                className={cn(
                  "chip shrink-0 border transition-colors",
                  filters.includes(f.id)
                    ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                    : "border-black/10 text-neutral-500 dark:border-white/10"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* grid */}
      <div className="section py-8 pb-32 lg:pb-8">
        {products.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <div className="text-5xl">🔍</div>
            <p className="text-lg font-semibold">Nič sme nenašli</p>
            <p className="text-sm text-neutral-500">
              Skúste iný filter alebo kategóriu.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} number={numberMap[p.id]} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function MenuPage() {
  return (
    <Suspense fallback={<div className="section py-20">Načítavam…</div>}>
      <MenuInner />
    </Suspense>
  );
}
