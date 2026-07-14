"use server";

import { signIn, signOut, auth } from "@/auth";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import {
  registerUser,
  bumpSessionVersion,
  deleteAccount,
  exportAccount,
  getRoleByEmail,
  changeUserPassword,
} from "./users";
import {
  loginSchema,
  registerSchema,
  changePasswordSchema,
  firstError,
} from "./validation";
import { rateLimit, audit, clientIp } from "./security";

export type FormState = { error?: string } | undefined;

export async function loginAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const ip = await clientIp();
  const rl = await rateLimit("login", ip, 10, 15 * 60);
  if (!rl.allowed) {
    await audit({ action: "login.rate_limited", target: parsed.data.email, meta: { ip } });
    return { error: "Príliš veľa pokusov. Skúste to o chvíľu." };
  }

  try {
    await signIn("credentials", { ...parsed.data, redirect: false });
  } catch (e) {
    if (e instanceof AuthError) {
      await audit({ action: "login.failed", target: parsed.data.email, meta: { ip } });
      return { error: "Nesprávny email alebo heslo." };
    }
    throw e;
  }
  // Determine the role from the DB, not from auth(): the session cookie set by
  // signIn() above is not yet readable within this same request, so auth()
  // would return a stale session and send admins to the customer page.
  const role = await getRoleByEmail(parsed.data.email);
  await audit({
    action: "login.success",
    actorEmail: parsed.data.email,
    meta: { ip },
  });
  redirect(
    role === "admin" || role === "super_admin"
      ? "/admin"
      : role === "driver"
      ? "/rozvoz"
      : role === "kuchar"
      ? "/kuchyna"
      : role === "call"
      ? "/call"
      : "/account"
  );
}

export async function registerFormAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    consent: formData.get("consent") === "on",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const ip = await clientIp();
  const rl = await rateLimit("register", ip, 5, 60 * 60);
  if (!rl.allowed) return { error: "Príliš veľa pokusov. Skúste to neskôr." };

  const res = await registerUser(
    parsed.data.name,
    parsed.data.email,
    parsed.data.password
  );
  if (!res.ok) return { error: res.error };
  await audit({
    action: "account.created",
    actorId: res.userId,
    actorEmail: parsed.data.email,
    meta: { ip },
  });

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch {
    redirect("/login");
  }
  redirect("/account");
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}

export async function logoutAllDevicesAction() {
  const session = await auth();
  if (session?.user?.id) {
    await bumpSessionVersion(session.user.id);
    await audit({
      action: "account.logout_all",
      actorId: session.user.id,
      actorEmail: session.user.email,
    });
  }
  await signOut({ redirectTo: "/" });
}

export async function deleteAccountAction() {
  const session = await auth();
  if (!session?.user?.id) return;
  await deleteAccount(session.user.id);
  await audit({
    action: "account.deleted",
    actorId: session.user.id,
    actorEmail: session.user.email,
  });
  await signOut({ redirectTo: "/" });
}

// Self-service password change for customers (once a week) and staff (used to
// clear a 30-day expiry). Verifies the current password, applies the policy,
// and — because changeUserPassword bumps session_version — the caller signs out
// afterwards and logs back in with the new password.
export async function changePasswordAction(
  current: string,
  next: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Neprihlásený." };
  const parsed = changePasswordSchema.safeParse({ current, next });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const rl = await rateLimit("pwchange", session.user.id, 5, 60 * 60);
  if (!rl.allowed)
    return { ok: false, error: "Príliš veľa pokusov. Skúste to neskôr." };

  const res = await changeUserPassword(
    session.user.id,
    parsed.data.current,
    parsed.data.next
  );
  if (res.ok) {
    await audit({
      action: "account.password_changed",
      actorId: session.user.id,
      actorEmail: session.user.email,
    });
  }
  return res;
}

export async function exportAccountAction() {
  const session = await auth();
  if (!session?.user?.id) return null;
  await audit({
    action: "account.exported",
    actorId: session.user.id,
    actorEmail: session.user.email,
  });
  return exportAccount(session.user.id);
}
