import Link from "next/link";
import { auth } from "@/auth";
import { AccountDashboard } from "@/components/AccountDashboard";
import { Footer } from "@/components/Footer";
import { LogIn, UserPlus, ShieldCheck } from "lucide-react";

export default async function AccountPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="section flex min-h-[80vh] items-center justify-center py-16">
        <div className="w-full max-w-md rounded-3xl border border-white/[0.08] bg-[#111111] p-8 text-center">
          <h1 className="font-heading text-3xl uppercase tracking-tight text-white">
            Váš účet
          </h1>
          <p className="mt-2 text-sm text-[#B5B5B5]">
            Prihláste sa alebo si vytvorte účet — objednávajte rýchlejšie a
            sledujte históriu.
          </p>
          <div className="mt-6 grid gap-3">
            <Link href="/login" className="btn-primary w-full">
              <LogIn className="h-4 w-4" /> Prihlásiť sa
            </Link>
            <Link href="/register" className="btn-ghost w-full">
              <UserPlus className="h-4 w-4" /> Registrácia
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const isAdmin = session.user.role === "admin";

  return (
    <main className="section py-10">
      {isAdmin && (
        <Link
          href="/admin"
          className="mb-6 flex items-center gap-3 rounded-2xl border border-brand-primary/30 bg-brand-primary/10 p-4 text-sm font-semibold text-brand-primary"
        >
          <ShieldCheck className="h-5 w-5" />
          Ste prihlásený ako administrátor —{" "}
          <span className="underline">otvoriť administráciu</span>
        </Link>
      )}
      <AccountDashboard
        name={session.user.name ?? ""}
        email={session.user.email ?? ""}
      />
      <Footer />
    </main>
  );
}
