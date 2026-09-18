import { normalizeName } from "@/lib/core/names";

export function seedAgencyAliases(): Map<string, string> {
  const m = new Map<string, string>();
  const rounds: Array<[string, string]> = [
    ["ROUND 1", "R1"],
    ["ROUND 2", "R2"],
    ["ROUND 3", "R3"],
    ["REVISION 1", "R1"],
    ["REVISION 2", "R2"],
    ["V1", "R1"],
    ["V2", "R2"],
    ["V3", "R3"],
  ];
  for (const [alias, canonical] of rounds) m.set(alias, canonical);
  return m;
}

export function normalizeClient(raw: string, aliases: Map<string, string>): string {
  return normalizeName(raw, aliases);
}

export function normalizeProject(raw: string, aliases: Map<string, string>): string {
  return normalizeName(raw, aliases);
}
