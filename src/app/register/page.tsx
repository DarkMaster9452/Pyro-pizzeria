"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerFormAction, type FormState } from "@/lib/auth-actions";
import { UserPlus } from "lucide-react";

export default function RegisterPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    registerFormAction,
    undefined
  );
  return (
    <main className="section flex min-h-[80vh] items-center justify-center py-16">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-white/[0.08] bg-[#111111] p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 inline-flex rounded-2xl bg-brand-primary/12 p-4 text-brand-primary">
              <UserPlus className="h-7 w-7" />
            </div>
            <h1 className="font-heading text-3xl uppercase tracking-tight text-white">
              Registrácia
            </h1>
            <p className="mt-1 text-sm text-[#B5B5B5]">
              Vytvorte si účet pre rýchlejšie objednávky a históriu.
            </p>
          </div>

          <form action={action} className="space-y-3">
            <Field name="name" type="text" placeholder="Meno a priezvisko" autoComplete="name" />
            <Field name="email" type="email" placeholder="Email" autoComplete="email" />
            <Field
              name="password"
              type="password"
              placeholder="Heslo (min. 10 znakov)"
              autoComplete="new-password"
            />
            <label className="flex items-start gap-2.5 text-xs text-[#B5B5B5]">
              <input
                type="checkbox"
                name="consent"
                required
                className="mt-0.5 h-4 w-4 shrink-0 accent-brand-primary"
              />
              <span>
                Súhlasím s{" "}
                <Link href="/terms" className="text-brand-primary underline">
                  obchodnými podmienkami
                </Link>{" "}
                a{" "}
                <Link href="/privacy" className="text-brand-primary underline">
                  spracovaním osobných údajov
                </Link>
                .
              </span>
            </label>
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
              <UserPlus className="h-4 w-4" />
              {pending ? "Vytváram účet…" : "Zaregistrovať sa"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-[#B5B5B5]">
            Už máte účet?{" "}
            <Link href="/login" className="font-semibold text-brand-primary">
              Prihláste sa
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      required
      className="w-full rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-brand-primary"
    />
  );
}
