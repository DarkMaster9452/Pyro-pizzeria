import { neon } from "@neondatabase/serverless";
import { logWarn } from "./log";

// Neon serverless driver over HTTPS — works in Node, Edge and behind the
// agent proxy. Use the `sql` tagged template for parameterised queries.
const url = process.env.DATABASE_URL;
if (!url) {
  // Surface a clear error instead of a cryptic driver failure at query time.
  logWarn("db", "DATABASE_URL is not set — database features disabled.");
}

export const sql = neon(url ?? "postgresql://invalid");
