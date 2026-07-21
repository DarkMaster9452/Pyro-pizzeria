// Lightweight, low-noise server logging. Every line the app emits gets one
// consistent "[pyro]" prefix so our own entries are easy to spot in the Neon /
// Vercel log stream, and errors are collapsed to a single compact line
// ("scope: message") instead of dumping a full stack trace on every failure.

function message(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

// Log a handled error as one compact line. Use for caught exceptions that the
// caller already recovers from — no stack spam, just what failed and why.
export function logError(scope: string, e: unknown): void {
  console.error(`[pyro] ${scope}: ${message(e)}`);
}

// Log a non-fatal notice (expected fallback, missing optional config, …).
export function logWarn(scope: string, m: string): void {
  console.warn(`[pyro] ${scope}: ${m}`);
}
