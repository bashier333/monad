export const KNOWN_FLAGS = ["copilot", "forecasts", "workflows", "search", "market"] as const;
export type Flag = (typeof KNOWN_FLAGS)[number];

export function flagEnabled(settings: unknown, flag: string): boolean {
  const flags = (settings as { featureFlags?: unknown } | null)?.featureFlags;
  if (flags !== undefined && !Array.isArray(flags)) return true;
  if (!Array.isArray(flags)) return true;
  return flags.includes(flag);
}

export function validateFlags(flags: unknown): { ok: true; flags: string[] } | { ok: false; error: string } {
  if (!Array.isArray(flags)) return { ok: false, error: "featureFlags must be an array" };
  const bad = flags.filter((f): f is string => typeof f !== "string" || !(KNOWN_FLAGS as readonly string[]).includes(f));
  if (bad.length > 0) return { ok: false, error: `unknown flags: ${bad.join(", ")} (known: ${KNOWN_FLAGS.join(", ")})` };
  return { ok: true, flags };
}
