import type { Badge } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Flame, Leaf, Sparkles, Star, ThumbsUp } from "lucide-react";

const CONFIG: Record<
  Badge,
  { label: string; className: string; icon: React.ReactNode }
> = {
  recommended: {
    label: "Odporúčame",
    className: "bg-brand-primary/10 text-brand-primary",
    icon: <ThumbsUp className="h-3 w-3" />,
  },
  spicy: {
    label: "Pikantné",
    className: "bg-red-500/10 text-red-600",
    icon: <Flame className="h-3 w-3" />,
  },
  vegetarian: {
    label: "Vegetariánske",
    className: "bg-green-500/10 text-green-700 dark:text-green-400",
    icon: <Leaf className="h-3 w-3" />,
  },
  new: {
    label: "Novinka",
    className: "bg-brand-secondary/15 text-brand-secondary",
    icon: <Sparkles className="h-3 w-3" />,
  },
  bestseller: {
    label: "Bestseller",
    className: "bg-brand-accent/20 text-amber-700 dark:text-brand-accent",
    icon: <Star className="h-3 w-3" />,
  },
};

export function ProductBadge({ badge }: { badge: Badge }) {
  const c = CONFIG[badge];
  return (
    <span className={cn("chip", c.className)}>
      {c.icon}
      {c.label}
    </span>
  );
}

export function BadgeRow({ badges }: { badges: Badge[] }) {
  if (!badges.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b) => (
        <ProductBadge key={b} badge={b} />
      ))}
    </div>
  );
}
