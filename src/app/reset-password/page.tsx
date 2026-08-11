"use client";

import { Suspense, useActionState, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  resetPasswordAction,
  type ResetRequestState,
} from "@/lib/auth-actions";
import { Lock, Eye, EyeOff, CheckCircle2, LogIn } from "lucide-react";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Shell>Načítavam…</Shell>}>
      <ResetForm />
    </Suspense>
  );
}

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [state, action, pending] = useActionState<ResetRequestState, FormData>(
    resetPasswordAction,
    undefined
  );
  const [show, setShow] = useState(false);

  if (state?.ok) {
    return (
      <Shell>
        <div className="text-center">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-brand-success" />
          <h1 className="font-heading text-2xl uppercase tracking-tight text-white">
            Heslo je zmenené
          </h1>
          <p className="mt-2 text-sm text-[#B5B5B5]">
            Z bezpečnostných dôvodov sme vás odhlásili zo všetkých zariadení.
            Prihláste sa novým heslom.
          </p>
          <Link href="/login" className="btn-primary mt-5 w-full">
            <LogIn className="h-4 w-4" />
            Prihlásiť sa
          </Link>
        </div>
      </Shell>
    );
  }

  if (!token) {
    return (
      <Shell>
        <div className="text-center">
          <h1 className="font-heading text-2xl uppercase tracking-tight text-white">
            Neplatný odkaz
          </h1>
          <p className="mt-2 text-sm text-[#B5B5B5]">
            Odkaz na obnovenie hesla je neúplný. Požiadajte o nový.
          </p>
          <Link href="/forgot-password" className="btn-primary mt-5 w-full">
            Požiadať o nový odkaz
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 inline-flex rounded-2xl bg-brand-primary/12 p-4 text-brand-primary">
          <Lock className="h-7 w-7" />
        </div>
        <h1 className="font-heading text-3xl uppercase tracking-tight text-white">
          Nové heslo
        </h1>
        <p className="mt-1 text-sm text-[#B5B5B5]">
          Min. 10 znakov, veľké aj malé písmeno a číslica.
        </p>
      </div>

      <form action={action} className="space-y-3">
        <input type="hidden" name="token" value={token} />
        <div className="relative">
          <input
            name="password"
            type={show ? "text" : "password"}
            required
            placeholder="Nové heslo"
            autoComplete="new-password"
            className="w-full rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-3 pr-12 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-brand-primary"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Skryť heslo" : "Zobraziť heslo"}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-neutral-400 hover:text-white"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {state?.error && (
          <p className="rounded-xl bg-brand-error/12 px-3 py-2 text-sm text-[#ff8f8f]">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="btn-primary w-full disabled:opacity-50"
        >
          {pending ? "Ukladám…" : "Nastaviť heslo"}
        </button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="section flex min-h-[80vh] items-center justify-center py-16">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-white/[0.08] bg-[#111111] p-8">
          {children}
        </div>
      </div>
    </main>
  );
}
