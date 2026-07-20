import type { NextAuthConfig } from "next-auth";

const useSecureCookies = process.env.NODE_ENV === "production";

// Edge-safe config (no DB imports) — shared by middleware and the full auth.
export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8, // 8h session expiration
    updateAge: 60 * 30, // refresh at most every 30 min
  },
  pages: { signIn: "/login" },
  useSecureCookies,
  cookies: {
    sessionToken: {
      name: `${useSecureCookies ? "__Secure-" : ""}authjs.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
  providers: [], // real providers are added in auth.ts (Node runtime)
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const role = auth?.user?.role;
      if (pathname.startsWith("/admin")) {
        return role === "admin" || role === "super_admin";
      }
      // Driver dispatch board — drivers and admins only.
      if (pathname.startsWith("/rozvoz")) {
        return (
          role === "driver" || role === "admin" || role === "super_admin"
        );
      }
      // Cook's kitchen board — cooks (and the owner). Plain admins watch the
      // kitchen read-only from /admin instead.
      if (pathname.startsWith("/kuchyna")) {
        return role === "kuchar" || role === "super_admin";
      }
      // Call board — the phone/counter account that only sees finished orders
      // and calls customers. Nothing else.
      if (pathname.startsWith("/call")) {
        return role === "call" || role === "super_admin";
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.restaurantId = user.restaurantId;
        token.sessionVersion = user.sessionVersion;
        token.name = user.name;
        // Absolute expiry for this login, from the role/open-state-aware
        // lifetime chosen at sign-in. Falls back to 1h if none was provided.
        const maxAge = user.sessionMaxAge ?? 60 * 60;
        token.expiresAt = Math.floor(Date.now() / 1000) + maxAge;
      } else {
        const exp = token.expiresAt as number | undefined;
        if (exp && Math.floor(Date.now() / 1000) > exp) {
          // Past the per-role expiry — strip identity so all guards fail.
          token.id = undefined;
          token.role = undefined;
          token.restaurantId = undefined;
        }
      }
      return token;
    },
    session({ session, token }) {
      // Enforce the per-role expiry: once passed, hand back a session with no
      // user so every guard (middleware + pages) treats it as logged out.
      const exp = token.expiresAt as number | undefined;
      if (exp && Math.floor(Date.now() / 1000) > exp) {
        return { ...session, user: undefined as unknown as typeof session.user };
      }
      if (session.user) {
        session.user.id = (token.id as string) ?? (token.sub as string);
        session.user.role = token.role as
          | "customer"
          | "employee"
          | "driver"
          | "kuchar"
          | "call"
          | "admin"
          | "super_admin";
        session.user.restaurantId =
          (token.restaurantId as string | null) ?? null;
        session.user.sessionVersion = (token.sessionVersion as number) ?? 0;
      }
      return session;
    },
  },
};
