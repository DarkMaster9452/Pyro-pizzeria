import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { RESTAURANTS } from "@/lib/data";
import { CookApp } from "@/components/CookApp";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const session = await auth();
  const role = session?.user?.role;
  if (
    (role !== "kuchar" && role !== "super_admin") ||
    !session?.user?.restaurantId
  ) {
    redirect("/login");
  }
  const r = RESTAURANTS.find((x) => x.id === session.user.restaurantId);
  return (
    <CookApp
      name={session.user.name ?? "Kuchár"}
      restaurantName={r?.name ?? "Prevádzka"}
    />
  );
}
