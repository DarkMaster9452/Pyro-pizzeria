import type { NextAuthConfig } from "next-auth";

// Edge-safe config (no DB imports) — shared by middleware and the full auth.
export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [], // real providers are added in auth.ts (Node runtime)
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isAdminArea = pathname.startsWith("/admin");
      if (!isAdminArea) return true;
      // Admin area requires an authenticated admin.
      return auth?.user?.role === "admin";
    },
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.restaurantId = user.restaurantId;
        token.name = user.name;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as "customer" | "admin";
        session.user.restaurantId = (token.restaurantId as string | null) ?? null;
      }
      return session;
    },
  },
};
