import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminApp } from "@/components/admin/AdminApp";
import { IdleTimeout } from "@/components/IdleTimeout";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (session?.user?.role !== "admin" || !session.user.restaurantId) {
    redirect("/login");
  }
  return (
    <>
      <IdleTimeout />
      <AdminApp
        restaurantId={session.user.restaurantId}
        adminName="Admin"
        adminEmail={session.user.email ?? ""}
      />
    </>
  );
}
