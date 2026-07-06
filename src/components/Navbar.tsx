"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { RESTAURANTS } from "@/lib/data";
import { getOpenState, cn } from "@/lib/utils";
import {
  Moon,
  Sun,
  ShoppingBag,
  ChevronDown,
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
  { href: "/track", label: "Sledovať" },
];

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
  const count = cart.reduce((s, l) => s + l.quantity, 0);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled
          ? "glass shadow-soft"
          : "bg-transparent"
      )}
    >
      <nav className="section flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🔥</span>
            <span className="hidden font-display text-lg font-extrabold sm:block">
              {restaurant ? restaurant.name : "Pyro & Polomárik"}
            </span>
          </Link>
          {restaurant && mounted && (
            <button
              onClick={clearRestaurant}
              className="hidden items-center gap-1 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary transition-colors hover:bg-brand-primary/20 md:flex"
            >
              {getOpenState(restaurant).open ? "🟢 Otvorené" : "🔴 Zatvorené"}
              <ChevronDown className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                pathname === l.href
                  ? "bg-brand-primary/10 text-brand-primary"
                  : "text-neutral-600 hover:text-brand-primary dark:text-neutral-300"
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {mounted && (
            <button
              onClick={toggleTheme}
              aria-label="Prepnúť tému"
              className="rounded-full p-2.5 text-neutral-600 transition-colors hover:bg-black/5 dark:text-neutral-300 dark:hover:bg-white/10"
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
            className="hidden rounded-full border border-brand-primary/20 px-4 py-2 text-sm font-medium text-brand-primary transition-colors hover:bg-brand-primary/5 sm:block dark:border-white/15 dark:text-neutral-100"
          >
            Účet
          </Link>
          <button
            onClick={() => setCartOpen(true)}
            className="relative rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary p-2.5 text-white shadow-glow"
            aria-label="Košík"
          >
            <ShoppingBag className="h-5 w-5" />
            {mounted && count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-accent text-[11px] font-bold text-brand-dark">
                {count}
              </span>
            )}
          </button>
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="rounded-full p-2.5 lg:hidden"
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
            className="overflow-hidden glass lg:hidden"
          >
            <div className="section grid gap-1 py-3">
              {LINKS.concat([{ href: "/account", label: "Účet" }]).map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl px-4 py-3 font-medium text-neutral-700 hover:bg-brand-primary/10 dark:text-neutral-200"
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
