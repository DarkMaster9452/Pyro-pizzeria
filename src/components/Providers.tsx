"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { Navbar } from "./Navbar";
import { Cart } from "./Cart";
import { RestaurantModal } from "./RestaurantModal";
import { MobileTabBar } from "./MobileTabBar";
import { usePathname } from "next/navigation";

export function Providers({ children }: { children: React.ReactNode }) {
  const theme = useApp((s) => s.theme);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  useEffect(() => setMounted(true), []);

  // The public site is always dark. Light/dark mode only applies inside the
  // admin panel, where it follows the theme toggle.
  useEffect(() => {
    const root = document.documentElement;
    const wantDark = isAdmin ? theme === "dark" : true;
    root.classList.toggle("dark", wantDark);
  }, [theme, isAdmin]);

  // Avoid hydration flash: render children but keep interactive shell hidden until mounted
  return (
    <>
      {!isAdmin && <Navbar />}
      {children}
      {mounted && !isAdmin && (
        <>
          <RestaurantModal />
          <Cart />
          <MobileTabBar />
        </>
      )}
    </>
  );
}
