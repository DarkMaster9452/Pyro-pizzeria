import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { verifyCredentials } from "./lib/users";
import { isRestaurantOpenNow } from "./lib/service-open";

// Login session lengths (seconds). Customers get a short session; staff stay
// logged in for a full shift while the shop is open, but only briefly when it
// is closed.
const CUSTOMER_MAX_AGE = 60 * 60; // 1h
const STAFF_MAX_AGE_OPEN = 60 * 60 * 8; // 8h
const STAFF_MAX_AGE_CLOSED = 60 * 60 * 2; // 2h

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Heslo", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "");
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;
        const user = await verifyCredentials(email, password);
        if (!user) return null;
        // Customers: short 1h session. Staff: long while the shop is open,
        // short when it is closed (evaluated at login time).
        let sessionMaxAge = CUSTOMER_MAX_AGE;
        if (user.role !== "customer") {
          sessionMaxAge = (await isRestaurantOpenNow(user.restaurant_id))
            ? STAFF_MAX_AGE_OPEN
            : STAFF_MAX_AGE_CLOSED;
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          restaurantId: user.restaurant_id,
          sessionVersion: user.session_version,
          sessionMaxAge,
        };
      },
    }),
  ],
});
