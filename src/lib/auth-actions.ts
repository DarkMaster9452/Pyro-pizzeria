"use server";

import { signIn, signOut, auth } from "@/auth";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import {
  registerUser,
  bumpSessionVersion,
  deleteAccount,
  exportAccount,
} from "./users";
import { loginSchema, registerSchema, firstError } from "./validation";
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
  const session = await auth();
  await audit({
    action: "login.success",
    actorId: session?.user?.id,
    actorEmail: session?.user?.email,
    meta: { ip },
  });
  redirect(
    session?.user?.role === "admin" || session?.user?.role === "super_admin"
      ? "/admin"
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
