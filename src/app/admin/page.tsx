import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminApp } from "@/components/admin/AdminApp";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (session?.user?.role !== "admin" || !session.user.restaurantId) {
    redirect("/login");
  }
  return (
    <AdminApp
      restaurantId={session.user.restaurantId}
      adminName={session.user.name ?? "Admin"}
      adminEmail={session.user.email ?? ""}
    />
  );
}
