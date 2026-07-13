import type { DefaultSession } from "next-auth";

type Role =
  | "customer"
  | "employee"
  | "driver"
  | "kuchar"
  | "call"
  | "admin"
  | "super_admin";

declare module "next-auth" {
  interface User {
    role?: Role;
    restaurantId?: string | null;
    sessionVersion?: number;
  }
  interface Session {
    user: {
      id: string;
      role: Role;
      restaurantId: string | null;
      sessionVersion: number;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    restaurantId?: string | null;
    sessionVersion?: number;
  }
}
