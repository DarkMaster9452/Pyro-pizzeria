import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Restaurant, DeliveryZone } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function eur(n: number): string {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

// JS getDay(): 0=Sun..6=Sat -> convert to our 0=Mon..6=Sun
export function jsDayToIndex(jsDay: number): number {
  return (jsDay + 6) % 7;
}

export interface OpenState {
  open: boolean;
  label: string;
  closesAt?: string;
  opensAt?: string;
}

export function getOpenState(r: Restaurant, now = new Date()): OpenState {
  const idx = jsDayToIndex(now.getDay());
  const today = r.openingHours.find((h) => h.day === idx);
  if (!today || today.closed) {
    return { open: false, label: "Zatvorené" };
  }
  const mins = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = today.open.split(":").map(Number);
  const [ch, cm] = today.close.split(":").map(Number);
  const openMin = oh * 60 + om;
  const closeMin = ch * 60 + cm;
  if (mins >= openMin && mins < closeMin) {
    return { open: true, label: "Otvorené", closesAt: today.close };
  }
  return { open: false, label: "Zatvorené", opensAt: today.open };
}

// Haversine distance in km
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export interface ZoneMatch {
  zone: DeliveryZone | null;
  matchedArea?: string;
}

// Match a street/city string against a restaurant's delivery zones.
export function findZone(r: Restaurant, query: string): ZoneMatch {
  const q = normalize(query);
  if (!q) return { zone: null };
  for (const zone of r.deliveryZones) {
    for (const area of zone.areas) {
      const a = normalize(area);
      if (q.includes(a) || a.includes(q)) {
        return { zone, matchedArea: area };
      }
    }
  }
  return { zone: null };
}

export function shortId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
