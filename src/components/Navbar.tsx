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
  Flame,
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

function Logo({ name, tag }: { name: string; tag: string }) {
  return (
    <Link href="/" className="group flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.04] text-brand-primary transition-colors group-hover:border-brand-primary/50">
        <Flame className="h-5 w-5" />
      </span>
      <span className="leading-none">
        <span className="block font-heading text-lg tracking-tight text-white">
          {name}
        </span>
        <span className="mt-1 block whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.3em] text-brand-primary">
          {tag}
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
      <nav className="section flex h-[84px] items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Logo
            name={restaurant ? restaurant.logoName : "Pyro & Polomárik"}
            tag={restaurant ? restaurant.logoTag : "PIZZA PLATFORM"}
          />
        </div>

        <div className="hidden items-center gap-7 lg:flex">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "relative py-1.5 text-[17px] font-medium transition-colors",
                  active ? "text-white" : "text-white/60 hover:text-white"
                )}
              >
                {l.label}
                {active && (
                  <motion.span
                    layoutId="nav-underline"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    className="absolute -bottom-1 left-0 h-[2px] w-full rounded-full bg-brand-primary"
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
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.04] text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white"
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
            className="hidden h-11 items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-5 text-[15px] font-medium text-white transition-colors hover:bg-white/[0.08] sm:flex"
          >
            <User className="h-4 w-4" />
            Účet
          </Link>
          <button
            onClick={() => setCartOpen(true)}
            className="flex h-11 items-center gap-2 rounded-full bg-brand-primary px-5 text-[15px] font-bold text-white shadow-glow transition-colors hover:bg-brand-primaryHover"
            aria-label="Košík"
          >
            <ShoppingBag className="h-[18px] w-[18px]" />
            <span className="tabular-nums">
              {mounted ? eur(total) : "0,00 €"}
            </span>
          </button>
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.04] text-white lg:hidden"
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
