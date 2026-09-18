export const PACK_IDS = ["freight", "agency"] as const;
export type PackId = (typeof PACK_IDS)[number];

export function isPackId(v: string): v is PackId {
  return (PACK_IDS as readonly string[]).includes(v);
}

export function packEnabled(settings: unknown, pack: string): boolean {
  const enabled = (settings as { enabledPacks?: unknown } | null)?.enabledPacks;
  if (!Array.isArray(enabled)) return true;
  return enabled.includes(pack);
}

export function packOrThrow(v: string | null): PackId {
  if (v !== null && isPackId(v)) return v;
  throw new Error(`unknown pack: ${v ?? "none"} (expected ${PACK_IDS.join("|")})`);
}
