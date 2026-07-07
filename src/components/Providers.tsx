"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { Navbar } from "./Navbar";
import { Cart } from "./Cart";
import { RestaurantModal } from "./RestaurantModal";
import { MobileTabBar } from "./MobileTabBar";
import { CookieConsent } from "./CookieConsent";
import { usePathname } from "next/navigation";

export function Providers({ children }: { children: React.ReactNode }) {
  const theme = useApp((s) => s.theme);
  const restaurantId = useApp((s) => s.restaurantId);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  const setSoldOut = useApp((s) => s.setSoldOut);

  useEffect(() => setMounted(true), []);

  // Hydrate sold-out state from the database (set by admins) on load.
  useEffect(() => {
    let active = true;
    import("@/lib/server-actions").then(({ getRestaurantStates }) =>
      getRestaurantStates().then((states) => {
        if (!active) return;
        for (const [id, value] of Object.entries(states)) setSoldOut(id, value);
      })
    );
    return () => {
      active = false;
    };
  }, [setSoldOut]);

  // The public site is always dark. Light/dark mode only applies inside the
  // admin panel, where it follows the theme toggle.
  useEffect(() => {
    const root = document.documentElement;
    const wantDark = isAdmin ? theme === "dark" : true;
    root.classList.toggle("dark", wantDark);
  }, [theme, isAdmin]);

  // Theme the whole page to the selected restaurant's brand colour (Pyro
  // orange vs Polomárik gold) so the two pizzerias feel distinct.
  useEffect(() => {
    const root = document.documentElement;
    if (!isAdmin && restaurantId) root.setAttribute("data-brand", restaurantId);
    else root.removeAttribute("data-brand");
  }, [restaurantId, isAdmin]);

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
          <CookieConsent />
        </>
      )}
    </>
  );
}
