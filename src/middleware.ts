import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Edge middleware: protects the /admin and /rozvoz areas via the
// `authorized` callback.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/admin/:path*", "/rozvoz/:path*", "/kuchyna/:path*"],
};
