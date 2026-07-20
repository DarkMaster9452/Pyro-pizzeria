"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getStorefront,
  createStaffOrder,
  updateStaffOrder,
  type StaffOrderInput,
} from "@/lib/server-actions";
import { CATEGORIES } from "@/lib/data";
import { eur, cn, shortId, pizzaNumbers } from "@/lib/utils";
import type { Product, CartLine } from "@/lib/types";

export interface StaffOrderInitial {
  fulfillment: "delivery" | "pickup";
  name: string;
  phone: string;
  address: string;
  note: string;
  items: { productId: string; quantity: number }[];
}
import {
  Search,
  Plus,
  Minus,
  Truck,
  Store,
  Phone,
  Check,
  Loader2,
} from "lucide-react";

// Phone-order entry used by both the admin panel and the driver board.
export function StaffOrderForm({
  restaurantId,
  onCreated,
  onSaved,
  orderId,
  initial,
  compact,
  updateFn,
}: {
  restaurantId: string;
  onCreated?: (id: string) => void;
  onSaved?: () => void;
  orderId?: string;
  initial?: StaffOrderInitial;
  compact?: boolean;
  // Override the save action when editing (e.g. the admin edit flow) — defaults
  // to the courier updateStaffOrder.
  updateFn?: (
    id: string,
    input: StaffOrderInput
  ) => Promise<{ ok: boolean; id?: string; error?: string }>;
}) {
  const editing = orderId != null;
  const [products, setProducts] = useState<Product[] | null>(null);
  const [qty, setQty] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const it of initial?.items ?? [])
      m[it.productId] = (m[it.productId] ?? 0) + it.quantity;
    return m;
  });
  const [q, setQ] = useState("");
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">(
    initial?.fulfillment ?? "pickup"
  );
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [okId, setOkId] = useState<string | null>(null);

  useEffect(() => {
    getStorefront()
      .then((s) =>
        setProducts(s.products.filter((p) => p.restaurantId === restaurantId))
      )
      .catch(() => setProducts([]));
  }, [restaurantId]);

  // Flyer numbers, computed over the whole menu (incl. unavailable) so they
  // match the printed leaflet regardless of availability.
  const numberMap = useMemo(
    () => pizzaNumbers(products ?? [], restaurantId),
    [products, restaurantId]
  );

  const filtered = useMemo(() => {
    const list = products ?? [];
    const norm = (s: string) => s.toLowerCase();
    const query = norm(q.trim());
    if (!query) return list;
    return list.filter((p) => {
      if (norm(p.name).includes(query)) return true;
      // Also match the flyer number (e.g. type "12" to find pizza #12) so staff
      // can enter orders straight from the leaflet, for pickup and delivery.
      const num = numberMap[p.id];
      return num != null && String(num).startsWith(query);
    });
  }, [products, q, numberMap]);

  const priceOf = (p: Product) => p.basePrice + (p.sizes[0]?.priceDelta ?? 0);
  const total = useMemo(() => {
    const list = products ?? [];
    return list.reduce((s, p) => s + priceOf(p) * (qty[p.id] ?? 0), 0);
  }, [products, qty]);

  const itemCount = Object.values(qty).reduce((s, n) => s + n, 0);

  function bump(id: string, delta: number) {
    setQty((m) => {
      const next = Math.max(0, (m[id] ?? 0) + delta);
      const copy = { ...m };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  }

  async function submit() {
    if (submitting) return;
    setError("");
    const list = products ?? [];
    const lines: CartLine[] = list
      .filter((p) => (qty[p.id] ?? 0) > 0)
      .map((p) => ({
        lineId: shortId(),
        productId: p.id,
        restaurantId,
        name: p.name,
        image: p.image,
        sizeId: p.sizes[0]?.id ?? "",
        sizeLabel: p.sizes[0]?.label ?? "",
        unitPrice: priceOf(p), // server re-prices authoritatively
        quantity: qty[p.id] ?? 1,
        extraCheese: false,
        stuffedCrust: false,
        addedIngredients: [],
        removedIngredients: [],
      }));

    if (lines.length === 0) return setError("Pridajte aspoň jednu položku.");

    const payload: StaffOrderInput = {
      restaurantId,
      fulfillment,
      customerName: name,
      phone,
      lines,
      note,
      address:
        fulfillment === "delivery" && address.trim()
          ? { street: address.trim(), houseNumber: "", city: "", zip: "" }
          : undefined,
    };

    setSubmitting(true);
    const res = editing
      ? await (updateFn ?? updateStaffOrder)(orderId!, payload)
      : await createStaffOrder(payload);
    setSubmitting(false);
    if (!res.ok) return setError(res.error ?? "Nepodarilo sa uložiť.");

    if (editing) {
      onSaved?.();
      return;
    }
    setOkId(res.id ?? null);
    setQty({});
    setName("");
    setPhone("");
    setAddress("");
    setNote("");
    onCreated?.(res.id ?? "");
  }

  const inputCls =
    "w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-primary dark:border-white/10 dark:bg-[#242424] dark:text-white";

  return (
    <div className={cn("grid gap-5", compact ? "" : "lg:grid-cols-[1fr_340px]")}>
      {/* product picker */}
      <div>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Hľadať produkt alebo číslo…"
            className={cn(inputCls, "pl-9")}
          />
        </div>
        {products === null ? (
          <p className="py-10 text-center text-sm text-neutral-500">
            Načítavam menu…
          </p>
        ) : (
          <div className="max-h-[460px] space-y-4 overflow-y-auto pr-1">
            {CATEGORIES.map((cat) => {
              const items = filtered.filter(
                (p) => p.category === cat.id && p.available
              );
              if (items.length === 0) return null;
              return (
                <div key={cat.id}>
                  <p className="sticky top-0 z-[1] mb-1.5 bg-white/90 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-400 backdrop-blur dark:bg-[#1a1a1a]/90">
                    {cat.icon} {cat.name}
                  </p>
                  {/* Whole menu as tap-to-add buttons (tap adds one, badge shows
                      the count, the − removes one). No photos, so it stays
                      compact enough to fit the whole menu. */}
                  {/* 2 columns on tablet (names stay readable), 3 only on very
                      wide screens. Buttons are a comfortable tap size without
                      crowding out the product name or spilling into neighbours. */}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                    {items.map((p) => {
                      const n = qty[p.id] ?? 0;
                      return (
                        <div
                          key={p.id}
                          className={cn(
                            "flex min-h-[60px] items-center gap-2 overflow-hidden rounded-xl border px-2.5 py-2 transition-colors",
                            n > 0
                              ? "border-brand-primary bg-brand-primary/10"
                              : "border-black/10 dark:border-white/10"
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-sm font-medium leading-tight text-neutral-900 dark:text-white">
                              {numberMap[p.id] != null && (
                                <span className="text-brand-primary">
                                  {numberMap[p.id]}.{" "}
                                </span>
                              )}
                              {p.name}
                            </p>
                            <p className="text-xs text-neutral-500">
                              {eur(priceOf(p))}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {n > 0 && (
                              <>
                                <button
                                  type="button"
                                  aria-label="Odobrať"
                                  onClick={() => bump(p.id, -1)}
                                  className="flex h-10 w-10 items-center justify-center rounded-full bg-black/10 text-neutral-800 transition-colors hover:bg-black/20 active:scale-95 dark:bg-white/15 dark:text-white"
                                >
                                  <Minus className="h-5 w-5" />
                                </button>
                                <span className="w-6 text-center text-base font-bold tabular-nums text-neutral-900 dark:text-white">
                                  {n}
                                </span>
                              </>
                            )}
                            <button
                              type="button"
                              aria-label="Pridať"
                              onClick={() => bump(p.id, 1)}
                              className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary text-white transition-colors hover:brightness-110 active:scale-95"
                            >
                              <Plus className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* customer + submit */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { id: "pickup", label: "Odber", icon: <Store className="h-4 w-4" /> },
              { id: "delivery", label: "Rozvoz", icon: <Truck className="h-4 w-4" /> },
            ] as const
          ).map((o) => (
            <button
              key={o.id}
              onClick={() => setFulfillment(o.id)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-semibold transition-colors",
                fulfillment === o.id
                  ? "border-brand-primary bg-brand-primary/5 text-brand-primary"
                  : "border-transparent bg-black/[0.04] text-neutral-600 dark:bg-white/5 dark:text-neutral-300"
              )}
            >
              {o.icon}
              {o.label}
            </button>
          ))}
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Meno (nepovinné)"
          className={inputCls}
        />
        <div className="relative">
          <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Telefón (nepovinné)"
            inputMode="tel"
            className={cn(inputCls, "pl-9")}
          />
        </div>

        {fulfillment === "delivery" && (
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
            placeholder="Adresa doručenia (napíšte celú adresu)"
            className={cn(inputCls, "resize-none")}
          />
        )}

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Poznámka (napr. bez cibule)"
          className={cn(inputCls, "resize-none")}
        />

        <div className="flex items-center justify-between rounded-xl bg-black/[0.04] px-3 py-2.5 text-sm dark:bg-white/5">
          <span className="text-neutral-500">{itemCount} položiek</span>
          <span className="font-display text-lg font-extrabold text-brand-primary">
            {eur(total)}
          </span>
        </div>

        {error && <p className="text-xs text-brand-error">{error}</p>}
        {okId && (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-success">
            <Check className="h-4 w-4" /> Objednávka #{okId} vytvorená.
          </p>
        )}

        <button
          onClick={submit}
          disabled={submitting || itemCount === 0}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-primary py-3 text-sm font-bold text-white transition-colors hover:brightness-110 disabled:opacity-40"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : editing ? (
            <Check className="h-4 w-4" />
          ) : (
            <Phone className="h-4 w-4" />
          )}
          {submitting
            ? "Ukladám…"
            : editing
            ? "Uložiť zmeny"
            : "Vytvoriť objednávku"}
        </button>
      </div>
    </div>
  );
}
