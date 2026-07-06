"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useApp } from "@/lib/store";
import { PRODUCTS, RESTAURANTS } from "@/lib/data";
import { eur } from "@/lib/utils";
import { Footer } from "@/components/Footer";
import { User, Heart, Clock, LogIn, Bell } from "lucide-react";

export default function AccountPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const orders = useApp((s) => s.orders);
  const favorites = useApp((s) => s.favorites);
  const favProducts = PRODUCTS.filter((p) => favorites.includes(p.id));

  if (!loggedIn) {
    return (
      <main className="section flex min-h-[70vh] items-center justify-center py-10">
        <div className="w-full max-w-md">
          <div className="card p-8">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 inline-flex rounded-2xl bg-brand-primary/10 p-4 text-brand-primary">
                <User className="h-8 w-8" />
              </div>
              <h1 className="font-display text-2xl font-extrabold">
                Prihlásenie
              </h1>
              <p className="mt-1 text-sm text-neutral-500">
                Objednávajte rýchlejšie a sledujte históriu.
              </p>
            </div>
            <div className="space-y-3">
              <input
                placeholder="Email"
                className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-brand-primary dark:border-white/10 dark:bg-[#242424]"
              />
              <input
                placeholder="Heslo"
                type="password"
                className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-brand-primary dark:border-white/10 dark:bg-[#242424]"
              />
              <button
                onClick={() => setLoggedIn(true)}
                className="btn-primary w-full"
              >
                <LogIn className="h-4 w-4" /> Prihlásiť sa
              </button>
            </div>
            <div className="my-4 flex items-center gap-3 text-xs text-neutral-400">
              <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
              alebo
              <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setLoggedIn(true)}
                className="rounded-xl border border-black/10 py-2.5 text-sm font-semibold dark:border-white/10"
              >
                 Apple
              </button>
              <button
                onClick={() => setLoggedIn(true)}
                className="rounded-xl border border-black/10 py-2.5 text-sm font-semibold dark:border-white/10"
              >
                G Google
              </button>
            </div>
            <p className="mt-4 text-center text-xs text-neutral-400">
              Nemáte účet?{" "}
              <button
                onClick={() => setLoggedIn(true)}
                className="font-semibold text-brand-primary"
              >
                Zaregistrujte sa
              </button>
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="section py-10">
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-primary to-brand-secondary text-2xl font-bold text-white">
          🍕
        </div>
        <div>
          <h1 className="font-display text-2xl font-extrabold">Môj účet</h1>
          <p className="text-sm text-neutral-500">strananekm@gmail.com</p>
        </div>
        <button
          onClick={() => setLoggedIn(false)}
          className="btn-ghost ml-auto"
        >
          Odhlásiť
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* order history */}
        <section className="card p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold">
            <Clock className="h-5 w-5 text-brand-secondary" /> História
            objednávok
          </h2>
          {orders.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Zatiaľ žiadne objednávky.
            </p>
          ) : (
            <div className="space-y-3">
              {orders.map((o) => {
                const r = RESTAURANTS.find((x) => x.id === o.restaurantId);
                return (
                  <div
                    key={o.id}
                    className="flex items-center justify-between rounded-xl bg-brand-bg p-3 dark:bg-[#242424]"
                  >
                    <div>
                      <p className="font-semibold">#{o.id}</p>
                      <p className="text-xs text-neutral-500">
                        {r?.name} · {o.lines.length} položiek
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-brand-primary">
                        {eur(o.total)}
                      </p>
                      <Link
                        href={`/track?id=${o.id}`}
                        className="text-xs font-semibold text-brand-secondary"
                      >
                        Sledovať / Objednať znova
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* favorites */}
        <section className="card p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold">
            <Heart className="h-5 w-5 text-brand-primary" /> Obľúbené
          </h2>
          {favProducts.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Zatiaľ žiadne obľúbené produkty. Klikni na ❤️ pri produkte.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {favProducts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-xl bg-brand-bg p-2 dark:bg-[#242424]"
                >
                  <div className="relative h-12 w-12 overflow-hidden rounded-lg">
                    <Image src={p.image} alt={p.name} fill className="object-cover" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight">
                      {p.name}
                    </p>
                    <p className="text-xs text-brand-primary">
                      {eur(p.basePrice)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* notifications */}
        <section className="card p-6 lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold">
            <Bell className="h-5 w-5 text-brand-accent" /> Notifikácie
          </h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {["Email", "SMS", "Push"].map((n) => (
              <label
                key={n}
                className="flex items-center justify-between rounded-xl bg-brand-bg p-3 dark:bg-[#242424]"
              >
                <span className="font-medium">{n}</span>
                <input type="checkbox" defaultChecked className="h-5 w-5 accent-brand-primary" />
              </label>
            ))}
          </div>
        </section>
      </div>
      <Footer />
    </main>
  );
}
