import { redirect } from "next/navigation";
import { getDispatchContext } from "@/lib/server-actions";
import { DriverApp } from "@/components/DriverApp";

export const dynamic = "force-dynamic";

export default async function DispatchPage() {
  const ctx = await getDispatchContext();
  if (!ctx) redirect("/login");
  return (
    <DriverApp
      role={ctx.role}
      name={ctx.name}
      restaurantId={ctx.restaurantId}
      restaurantName={ctx.restaurantName}
      restaurantAddress={ctx.restaurantAddress}
      userId={ctx.userId}
      onShift={ctx.onShift}
    />
  );
}
