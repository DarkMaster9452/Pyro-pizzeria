import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role?: "customer" | "admin";
    restaurantId?: string | null;
  }
  interface Session {
    user: {
      role: "customer" | "admin";
      restaurantId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "customer" | "admin";
    restaurantId?: string | null;
  }
}
