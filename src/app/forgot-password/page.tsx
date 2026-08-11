"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  requestPasswordResetAction,
  type ResetRequestState,
} from "@/lib/auth-actions";
import Captcha from "@/components/Captcha";
import { KeyRound, Mail, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState<ResetRequestState, FormData>(
    requestPasswordResetAction,
    undefined
  );

  return (
    <main className="section flex min-h-[80vh] items-center justify-center py-16">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-white/[0.08] bg-[#111111] p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 inline-flex rounded-2xl bg-brand-primary/12 p-4 text-brand-primary">
              <KeyRound className="h-7 w-7" />
            </div>
            <h1 className="font-heading text-3xl uppercase tracking-tight text-white">
              Zabudnuté heslo
            </h1>
            <p className="mt-1 text-sm text-[#B5B5B5]">
              Zadajte email a pošleme vám odkaz na nastavenie nového hesla.
            </p>
          </div>

          {state?.ok ? (
            // Same message whether or not the address has an account — the
            // server answers identically, so nobody can probe for registered
            // customers here.
            <div className="rounded-xl bg-white/[0.04] px-4 py-5 text-center text-sm text-[#B5B5B5]">
              <Mail className="mx-auto mb-2 h-6 w-6 text-brand-primary" />
              <p>
                Ak k tomuto emailu existuje účet, poslali sme naň odkaz na
                obnovenie hesla.
              </p>
              <p className="mt-2 text-xs">
                Odkaz je platný 30 minút. Skontrolujte aj priečinok spam.
              </p>
            </div>
          ) : (
            <form action={action} className="space-y-3">
              <input
                name="email"
                type="email"
                required
                placeholder="Email"
                autoComplete="email"
                className="w-full rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-brand-primary"
              />
              {state?.error && (
                <p className="rounded-xl bg-brand-error/12 px-3 py-2 text-sm text-[#ff8f8f]">
                  {state.error}
                </p>
              )}
              <Captcha />
              <button
                type="submit"
                disabled={pending}
                className="btn-primary w-full disabled:opacity-50"
              >
                <Mail className="h-4 w-4" />
                {pending ? "Odosielam…" : "Poslať odkaz"}
              </button>
            </form>
          )}

          <p className="mt-5 text-center text-sm">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-[#B5B5B5] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Späť na prihlásenie
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
