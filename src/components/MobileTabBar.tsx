"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/lib/store";
import { subtotal } from "@/lib/pricing";
import { eur, cn } from "@/lib/utils";
import { Home, UtensilsCrossed, Tag, User, ShoppingBag } from "lucide-react";

const ITEMS = [
  { href: "/", label: "Domov", icon: Home },
  { href: "/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/offers", label: "Akcie", icon: Tag },
  { href: "/account", label: "Účet", icon: User },
];

export function MobileTabBar() {
  const pathname = usePathname();
  const cart = useApp((s) => s.cart);
  const setCartOpen = useApp((s) => s.setCartOpen);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const count = cart.reduce((s, l) => s + l.quantity, 0);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
      <div className="mx-auto mb-3 flex max-w-md items-center justify-between gap-1 rounded-full border border-white/[0.08] bg-[#111111]/90 px-2.5 py-2 backdrop-blur-xl shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)]">
        {ITEMS.slice(0, 2).map((it) => (
          <TabLink key={it.href} {...it} active={pathname === it.href} />
        ))}

        {/* center cart FAB */}
        <button
          onClick={() => setCartOpen(true)}
          aria-label="Košík"
          className="relative -mt-6 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white shadow-glow"
        >
          <ShoppingBag className="h-6 w-6" />
          {mounted && count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#111111] bg-brand-accent px-1 text-[11px] font-bold text-black">
              {count}
            </span>
          )}
        </button>

        {ITEMS.slice(2).map((it) => (
          <TabLink key={it.href} {...it} active={pathname === it.href} />
        ))}
      </div>
    </div>
  );
}

function TabLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex flex-1 flex-col items-center gap-1 rounded-full px-2 py-1.5 text-[11px] font-semibold transition-colors",
        active ? "text-brand-primary" : "text-white/55"
      )}
    >
      <Icon className="h-5 w-5" />
      {label}
      {active && (
        <motion.span
          layoutId="tab-dot"
          className="absolute -bottom-0 h-1 w-1 rounded-full bg-brand-primary"
        />
      )}
    </Link>
  );
}
