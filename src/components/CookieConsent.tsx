"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie } from "lucide-react";

const KEY = "pyro-cookie-consent";

export function CookieConsent() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {}
  }, []);

  function decide(value: "accepted" | "essential") {
    try {
      localStorage.setItem(KEY, value);
    } catch {}
    setShow(false);
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          className="fixed inset-x-3 bottom-24 z-[70] mx-auto max-w-2xl rounded-2xl border border-white/[0.1] bg-[#111111]/95 p-4 backdrop-blur-xl shadow-2xl sm:inset-x-6 lg:bottom-6"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Cookie className="h-6 w-6 shrink-0 text-brand-accent" />
            <p className="flex-1 text-sm text-[#B5B5B5]">
              Používame nevyhnutné cookies pre fungovanie webu a voliteľné pre
              zlepšenie služieb. Viac v{" "}
              <Link href="/privacy" className="text-brand-primary underline">
                zásadách ochrany súkromia
              </Link>
              .
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => decide("essential")}
                className="rounded-full border border-white/[0.12] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.06]"
              >
                Len nevyhnutné
              </button>
              <button
                onClick={() => decide("accepted")}
                className="rounded-full bg-brand-primary px-4 py-2 text-sm font-bold text-white hover:bg-brand-primaryHover"
              >
                Prijať všetky
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
