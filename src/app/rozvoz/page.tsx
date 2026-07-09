import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { RESTAURANTS } from "@/lib/data";
import { DriverApp } from "@/components/DriverApp";

export const dynamic = "force-dynamic";

export default async function DispatchPage() {
  const session = await auth();
  const role = session?.user?.role;
  if (
    (role !== "driver" && role !== "admin" && role !== "super_admin") ||
    !session?.user?.restaurantId
  ) {
    redirect("/login");
  }
  const r = RESTAURANTS.find((x) => x.id === session.user.restaurantId);
  return (
    <DriverApp
      role={role}
      name={session.user.name ?? "Kuriér"}
      restaurantId={session.user.restaurantId}
      restaurantName={r?.name ?? "Prevádzka"}
      restaurantAddress={r?.address ?? ""}
      userId={session.user.id}
    />
  );
}
