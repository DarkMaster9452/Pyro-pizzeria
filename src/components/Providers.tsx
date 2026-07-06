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

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

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
