import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Edge middleware: protects the /admin area via the `authorized` callback.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/admin/:path*"],
};
