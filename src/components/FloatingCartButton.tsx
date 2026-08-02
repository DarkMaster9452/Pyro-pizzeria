"use client";

import { useEffect, useRef } from "react";
import { useApp } from "@/lib/store";
import { subtotal } from "@/lib/pricing";
import { eur } from "@/lib/utils";
import { ShoppingBag } from "lucide-react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";

export function FloatingCartButton() {
  const cart = useApp((s) => s.cart);
  const setCartOpen = useApp((s) => s.setCartOpen);
  const cartOpen = useApp((s) => s.cartOpen);
  const cartPulse = useApp((s) => s.cartPulse);
  const count = cart.reduce((s, l) => s + l.quantity, 0);

  // Light bounce each time something is added, so the cart clearly reacts.
  const controls = useAnimationControls();
  const firstPulse = useRef(true);
  useEffect(() => {
    if (firstPulse.current) {
      firstPulse.current = false;
      return;
    }
    controls.start({
      scale: [1, 1.08, 0.98, 1],
      transition: { duration: 0.4, ease: "easeInOut" },
    });
  }, [cartPulse, controls]);

  return (
    <AnimatePresence>
      {count > 0 && !cartOpen && (
        <motion.button
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          onClick={() => setCartOpen(true)}
          className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary px-6 py-3.5 font-semibold text-white shadow-glow sm:bottom-6 lg:hidden"
        >
          <motion.span animate={controls} className="flex items-center gap-3">
            <ShoppingBag className="h-5 w-5" />
            <span>{count} položiek</span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-sm">
              {eur(subtotal(cart))}
            </span>
          </motion.span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
