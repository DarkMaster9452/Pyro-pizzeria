import { redirect } from "next/navigation";
import { getKitchenContext } from "@/lib/server-actions";
import { CookApp } from "@/components/CookApp";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const ctx = await getKitchenContext();
  // /kuchyna is for cooks (and the owner); plain admins watch from /admin.
  if (!ctx || (ctx.role !== "kuchar" && ctx.role !== "super_admin")) {
    redirect("/login");
  }
  return (
    <CookApp
      name={ctx.name}
      restaurantName={ctx.restaurantName}
      onShift={ctx.onShift}
    />
  );
}
