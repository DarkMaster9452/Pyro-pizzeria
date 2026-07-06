"use client";

import Image from "next/image";
import Link from "next/link";
import { useApp } from "@/lib/store";
import { PRODUCTS, RESTAURANTS } from "@/lib/data";
import { eur } from "@/lib/utils";
import { logoutAction } from "@/lib/auth-actions";
import { Heart, Clock, Bell, LogOut } from "lucide-react";

export function AccountDashboard({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  const orders = useApp((s) => s.orders);
  const favorites = useApp((s) => s.favorites);
  const favProducts = PRODUCTS.filter((p) => favorites.includes(p.id));

  return (
    <>
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-primary to-brand-secondary text-2xl font-bold text-white">
          {(name || email).slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h1 className="font-heading text-3xl uppercase tracking-tight text-white">
            {name || "Môj účet"}
          </h1>
          <p className="text-sm text-[#B5B5B5]">{email}</p>
        </div>
        <form action={logoutAction} className="ml-auto">
          <button className="btn-ghost">
            <LogOut className="h-4 w-4" /> Odhlásiť
          </button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-white/[0.08] bg-[#141414] p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-white">
            <Clock className="h-5 w-5 text-brand-secondary" /> História objednávok
          </h2>
          {orders.length === 0 ? (
            <p className="text-sm text-[#B5B5B5]">Zatiaľ žiadne objednávky.</p>
          ) : (
            <div className="space-y-3">
              {orders.map((o) => {
                const r = RESTAURANTS.find((x) => x.id === o.restaurantId);
                return (
                  <div
                    key={o.id}
                    className="flex items-center justify-between rounded-xl bg-white/[0.03] p-3"
                  >
                    <div>
                      <p className="font-semibold text-white">#{o.id}</p>
                      <p className="text-xs text-neutral-400">
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

        <section className="rounded-3xl border border-white/[0.08] bg-[#141414] p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-white">
            <Heart className="h-5 w-5 text-brand-primary" /> Obľúbené
          </h2>
          {favProducts.length === 0 ? (
            <p className="text-sm text-[#B5B5B5]">
              Zatiaľ žiadne obľúbené. Klikni na ❤︎ pri produkte.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {favProducts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-xl bg-white/[0.03] p-2"
                >
                  <div className="relative h-12 w-12 overflow-hidden rounded-lg">
                    <Image src={p.image} alt={p.name} fill className="object-cover" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight text-white">
                      {p.name}
                    </p>
                    <p className="text-xs text-brand-primary">{eur(p.basePrice)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-white/[0.08] bg-[#141414] p-6 lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-white">
            <Bell className="h-5 w-5 text-brand-accent" /> Notifikácie
          </h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {["Email", "SMS", "Push"].map((n) => (
              <label
                key={n}
                className="flex items-center justify-between rounded-xl bg-white/[0.03] p-3 text-white"
              >
                <span className="font-medium">{n}</span>
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-5 w-5 accent-brand-primary"
                />
              </label>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
