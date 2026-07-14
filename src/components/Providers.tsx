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
  // Staff surfaces (admin panel + driver dispatch board + kitchen board) have
  // their own full chrome — hide the customer navbar, cart, restaurant picker
  // and tab bar so they don't overlap (the restaurant modal would otherwise
  // block the board).
  const hideChrome =
    isAdmin ||
    pathname?.startsWith("/rozvoz") ||
    pathname?.startsWith("/kuchyna") ||
    pathname?.startsWith("/call");

  const setSoldOut = useApp((s) => s.setSoldOut);
  const setStorefront = useApp((s) => s.setStorefront);

  useEffect(() => setMounted(true), []);

  // Hydrate sold-out state + live menu/coupons/zones from the database
  // (edited by admins) on load, so the storefront reflects real data.
  useEffect(() => {
    let active = true;
    import("@/lib/server-actions").then(
      ({ getRestaurantStates, getStorefront }) => {
        getRestaurantStates().then((states) => {
          if (!active) return;
          for (const [id, value] of Object.entries(states))
            setSoldOut(id, value);
        });
        getStorefront().then((data) => {
          if (!active) return;
          setStorefront(data);
        });
      }
    );
    return () => {
      active = false;
    };
  }, [setSoldOut, setStorefront]);

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

  // Swap the browser-tab favicon to the rounded logo of the pizzeria the guest
  // is currently on (falls back to the neutral brand icon before they pick one).
  useEffect(() => {
    // Pyro logo is the default/Pyro favicon (self-contained SVG so it renders
    // reliably in the tab); Polomárik keeps its own icon while browsing it.
    const href =
      restaurantId === "polomarik"
        ? "/logos/polomarik-icon.svg"
        : "/logos/pyro.svg";
    let link = document.querySelector<HTMLLinkElement>(
      'link[rel="icon"]'
    );
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.type = "image/svg+xml";
    link.href = href;
  }, [restaurantId]);

  // Avoid hydration flash: render children but keep interactive shell hidden until mounted
  return (
    <>
      {!hideChrome && <Navbar />}
      {children}
      {mounted && !hideChrome && (
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
