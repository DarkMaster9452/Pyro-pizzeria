"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { RESTAURANTS } from "@/lib/data";
import { subtotal } from "@/lib/pricing";
import { getOpenState, eur, cn } from "@/lib/utils";
import {
  Moon,
  Sun,
  ShoppingBag,
  ChevronDown,
  User,
  Menu as MenuIcon,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const LINKS = [
  { href: "/", label: "Domov" },
  { href: "/menu", label: "Menu" },
  { href: "/offers", label: "Akcie" },
  { href: "/about", label: "O nás" },
  { href: "/contact", label: "Kontakt" },
  { href: "/track", label: "Sledovať objednávku" },
];

function Logo({ name }: { name: string }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-b from-[#EF4136] to-[#C81E17] text-xl shadow-glow">
        🍅
      </span>
      <span className="leading-none">
        <span className="block font-script text-2xl text-white">{name}</span>
        <span className="block text-[9px] font-bold uppercase tracking-[0.28em] text-brand-red">
          Pizza z pece
        </span>
      </span>
    </Link>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const restaurantId = useApp((s) => s.restaurantId);
  const clearRestaurant = useApp((s) => s.clearRestaurant);
  const theme = useApp((s) => s.theme);
  const toggleTheme = useApp((s) => s.toggleTheme);
  const cart = useApp((s) => s.cart);
  const setCartOpen = useApp((s) => s.setCartOpen);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const restaurant = RESTAURANTS.find((r) => r.id === restaurantId);
  const total = subtotal(cart);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-white/5 bg-brand-ink/80 backdrop-blur-xl"
          : "bg-transparent"
      )}
    >
      <nav className="section flex h-[72px] items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Logo name={restaurant ? restaurant.logoName : "Pyro & Polomárik"} />
        </div>

        <div className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "relative px-3.5 py-2 text-[15px] font-medium transition-colors",
                  active
                    ? "text-brand-red"
                    : "text-neutral-300 hover:text-white"
                )}
              >
                {l.label}
                {active && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute inset-x-3.5 -bottom-0.5 h-0.5 rounded-full bg-brand-red"
                  />
                )}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2.5">
          {mounted && (
            <button
              onClick={toggleTheme}
              aria-label="Prepnúť tému"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-neutral-200 transition-colors hover:bg-white/10"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>
          )}
          <Link
            href="/account"
            className="hidden items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10 sm:flex"
          >
            <User className="h-4 w-4" />
            Účet
          </Link>
          <button
            onClick={() => setCartOpen(true)}
            className="flex items-center gap-2 rounded-full bg-gradient-to-b from-[#EF4136] to-[#C81E17] px-4 py-2.5 text-sm font-bold text-white shadow-glow"
            aria-label="Košík"
          >
            <ShoppingBag className="h-4.5 w-4.5" />
            <span className="tabular-nums">
              {mounted ? eur(total) : "0,00 €"}
            </span>
          </button>
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white lg:hidden"
            aria-label="Menu"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <MenuIcon className="h-5 w-5" />
            )}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/5 bg-brand-ink/95 backdrop-blur-xl lg:hidden"
          >
            <div className="section grid gap-1 py-3">
              {restaurant && (
                <button
                  onClick={() => {
                    clearRestaurant();
                    setMobileOpen(false);
                  }}
                  className="mb-1 flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 text-sm font-semibold text-white"
                >
                  <span className="flex items-center gap-2">
                    {mounted && getOpenState(restaurant).open
                      ? "🟢 Otvorené"
                      : "🔴 Zatvorené"}{" "}
                    · {restaurant.city}
                  </span>
                  <span className="flex items-center gap-1 text-brand-red">
                    Zmeniť <ChevronDown className="h-4 w-4" />
                  </span>
                </button>
              )}
              {LINKS.concat([{ href: "/account", label: "Účet" }]).map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl px-4 py-3 font-medium text-neutral-200 hover:bg-white/5"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
