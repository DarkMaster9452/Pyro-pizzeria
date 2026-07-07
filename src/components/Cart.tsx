"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { RESTAURANTS, COUPONS } from "@/lib/data";
import { computeTotals, subtotal } from "@/lib/pricing";
import { eur } from "@/lib/utils";
import {
  Minus,
  Plus,
  Trash2,
  X,
  Tag,
  Clock,
  ShoppingBag,
  Check,
} from "lucide-react";

export function Cart() {
  const cartOpen = useApp((s) => s.cartOpen);
  const setCartOpen = useApp((s) => s.setCartOpen);
  const cart = useApp((s) => s.cart);
  const updateQty = useApp((s) => s.updateQty);
  const removeLine = useApp((s) => s.removeLine);
  const restaurantId = useApp((s) => s.restaurantId);
  const coupon = useApp((s) => s.coupon);
  const setCoupon = useApp((s) => s.setCoupon);
  const [code, setCode] = useState("");
  const [couponError, setCouponError] = useState("");

  const soldOut = useApp((s) => (restaurantId ? s.soldOut[restaurantId] : false));
  const restaurant = RESTAURANTS.find((r) => r.id === restaurantId);
  const totals = computeTotals(cart, restaurantId, null, "pickup", coupon);
  const sub = subtotal(cart);
  const minOrder = restaurant?.deliveryZones[0]?.minimumOrder ?? 10;
  const belowMin = sub < minOrder;

  function applyCoupon() {
    const c = COUPONS.find(
      (x) =>
        x.code.toUpperCase() === code.toUpperCase() &&
        (x.restaurantId === "all" || x.restaurantId === restaurantId)
    );
    if (!c) {
      setCouponError("Neplatný kód.");
      return;
    }
    if (sub < c.minSubtotal) {
      setCouponError(`Platí od ${eur(c.minSubtotal)}.`);
      return;
    }
    setCouponError("");
    setCoupon(c.code);
    setCode("");
  }

  return (
    <AnimatePresence>
      {cartOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCartOpen(false)}
            className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 z-[95] flex h-full w-full max-w-md flex-col bg-brand-bg shadow-2xl dark:bg-[#181818]"
          >
            <div className="flex items-center justify-between border-b border-black/5 p-5 dark:border-white/10">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-brand-primary" />
                <h2 className="font-display text-xl font-bold">Váš košík</h2>
              </div>
              <button
                onClick={() => setCartOpen(false)}
                className="rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="text-6xl">🛒</div>
                <p className="text-lg font-semibold">Košík je prázdny</p>
                <p className="text-sm text-neutral-500">
                  Pridajte si niečo dobré z menu.
                </p>
                <Link
                  href="/menu"
                  onClick={() => setCartOpen(false)}
                  className="btn-primary"
                >
                  Prejsť do menu
                </Link>
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto p-5">
                  {cart.map((l) => (
                    <motion.div
                      key={l.lineId}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 40 }}
                      className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm dark:bg-[#242424]"
                    >
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
                        <Image
                          src={l.image}
                          alt={l.name}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      </div>
                      <div className="flex flex-1 flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold leading-tight">
                              {l.name}
                            </p>
                            <p className="text-xs text-neutral-500">
                              {l.sizeLabel}
                              {l.extraCheese && " · extra syr"}
                              {l.stuffedCrust && " · plnený okraj"}
                            </p>
                            {l.addedIngredients.length > 0 && (
                              <p className="text-xs text-brand-secondary">
                                + {l.addedIngredients.join(", ")}
                              </p>
                            )}
                            {l.removedIngredients.length > 0 && (
                              <p className="text-xs text-neutral-400 line-through">
                                {l.removedIngredients.join(", ")}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => removeLine(l.lineId)}
                            className="text-neutral-400 hover:text-brand-error"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <div className="flex items-center gap-2 rounded-full bg-brand-bg p-1 dark:bg-[#1a1a1a]">
                            <button
                              onClick={() =>
                                updateQty(l.lineId, l.quantity - 1)
                              }
                              className="rounded-full bg-white p-1.5 shadow-sm dark:bg-[#333]"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-6 text-center text-sm font-semibold">
                              {l.quantity}
                            </span>
                            <button
                              onClick={() =>
                                updateQty(l.lineId, l.quantity + 1)
                              }
                              className="rounded-full bg-white p-1.5 shadow-sm dark:bg-[#333]"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <span className="font-bold text-brand-primary">
                            {eur(l.unitPrice * l.quantity)}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {/* coupon */}
                  <div className="rounded-2xl bg-white p-3 dark:bg-[#242424]">
                    {coupon ? (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm font-semibold text-brand-success">
                          <Check className="h-4 w-4" /> Kupón {coupon}
                        </span>
                        <button
                          onClick={() => setCoupon(null)}
                          className="text-xs text-neutral-400 hover:text-brand-error"
                        >
                          Odstrániť
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex gap-2">
                          <div className="flex flex-1 items-center gap-2 rounded-full bg-brand-bg px-3 dark:bg-[#1a1a1a]">
                            <Tag className="h-4 w-4 text-neutral-400" />
                            <input
                              value={code}
                              onChange={(e) => setCode(e.target.value)}
                              placeholder="Zľavový kód"
                              className="w-full bg-transparent py-2 text-sm outline-none"
                            />
                          </div>
                          <button
                            onClick={applyCoupon}
                            className="rounded-full bg-brand-dark px-4 text-sm font-semibold text-white dark:bg-white dark:text-brand-dark"
                          >
                            Použiť
                          </button>
                        </div>
                        {couponError && (
                          <p className="mt-1 text-xs text-brand-error">
                            {couponError}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-neutral-400">
                          Skúste: PYRO10, FREEDELIVERY, HAPPY5
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* footer */}
                <div className="space-y-3 border-t border-black/5 bg-white p-5 dark:border-white/10 dark:bg-[#1c1c1c]">
                  <div className="flex items-center gap-2 rounded-xl bg-brand-secondary/10 px-3 py-2 text-sm text-brand-secondary">
                    <Clock className="h-4 w-4" />
                    Odhadovaná príprava ~{restaurant?.prepTimeMinutes ?? 25} min
                  </div>

                  {belowMin && (
                    <div className="rounded-xl bg-brand-accent/15 px-3 py-2 text-sm font-medium text-amber-700 dark:text-brand-accent">
                      Do minimálnej objednávky ({eur(minOrder)}) vám chýba{" "}
                      {eur(minOrder - sub)}.
                    </div>
                  )}

                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-neutral-500">
                      <span>Medzisúčet</span>
                      <span>{eur(totals.subtotal)}</span>
                    </div>
                    {totals.discount > 0 && (
                      <div className="flex justify-between text-brand-success">
                        <span>Zľava</span>
                        <span>-{eur(totals.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-dashed border-black/10 pt-2 text-base font-bold dark:border-white/10">
                      <span>Spolu</span>
                      <span>{eur(totals.total)}</span>
                    </div>
                    <p className="text-xs text-neutral-400">
                      Doprava a DPH sa vypočítajú pri pokladni.
                    </p>
                  </div>

                  {soldOut ? (
                    <div className="w-full rounded-full bg-brand-error/12 px-4 py-3 text-center text-sm font-semibold text-[#ff8f8f]">
                      Momentálne vypredané — objednávky sú dočasne pozastavené.
                    </div>
                  ) : (
                    <Link
                      href="/checkout"
                      onClick={() => setCartOpen(false)}
                      className="btn-primary w-full"
                    >
                      Pokračovať k objednávke
                    </Link>
                  )}
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
