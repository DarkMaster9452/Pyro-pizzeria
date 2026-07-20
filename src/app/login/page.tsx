"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { loginAction, type FormState } from "@/lib/auth-actions";
import { LogIn, Lock, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    loginAction,
    undefined
  );
  return (
    <main className="section flex min-h-[80vh] items-center justify-center py-16">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-white/[0.08] bg-[#111111] p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 inline-flex rounded-2xl bg-brand-primary/12 p-4 text-brand-primary">
              <Lock className="h-7 w-7" />
            </div>
            <h1 className="font-heading text-3xl uppercase tracking-tight text-white">
              Prihlásenie
            </h1>
            <p className="mt-1 text-sm text-[#B5B5B5]">
              Prihláste sa do svojho účtu alebo administrácie.
            </p>
          </div>

          <form action={action} className="space-y-3">
            <Field name="email" type="email" placeholder="Email" autoComplete="email" />
            <PasswordField
              name="password"
              placeholder="Heslo"
              autoComplete="current-password"
            />
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
              <LogIn className="h-4 w-4" />
              {pending ? "Prihlasujem…" : "Prihlásiť sa"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-[#B5B5B5]">
            Nemáte účet?{" "}
            <Link href="/register" className="font-semibold text-brand-primary">
              Zaregistrujte sa
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

function PasswordField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        type={show ? "text" : "password"}
        required
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
  );
}
