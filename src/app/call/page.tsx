import { redirect } from "next/navigation";
import { getCallContext } from "@/lib/server-actions";
import { CallApp } from "@/components/CallApp";

export const dynamic = "force-dynamic";

export default async function CallPage() {
  const ctx = await getCallContext();
  if (!ctx) redirect("/login");
  return <CallApp name={ctx.name} restaurantName={ctx.restaurantName} />;
}
