"use server";

import { signIn, signOut, auth } from "@/auth";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { registerUser } from "./users";

export type FormState = { error?: string } | undefined;

export async function loginAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (e) {
    if (e instanceof AuthError)
      return { error: "Nesprávny email alebo heslo." };
    throw e;
  }
  const session = await auth();
  redirect(session?.user?.role === "admin" ? "/admin" : "/account");
}

export async function registerFormAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const name = String(formData.get("name") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const res = await registerUser(name, email, password);
  if (!res.ok) return { error: res.error };
  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch {
    redirect("/login");
  }
  redirect("/account");
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}
