import { AGENCY_ONTOLOGY } from "@/lib/packs/agency/ontology";
import { FREIGHT_ONTOLOGY } from "@/lib/packs/freight/ontology";
import { listTypes } from "@/lib/core/ontology/registry";

export interface LivePackModel {
  source: "live" | "constant";
  packId: string;
  entities: string[];
  measures: Array<{ name: string; unit: string }>;
  vocabulary: Record<string, string>;
  ruleIds: string[];
}

const CONSTANTS = {
  freight: FREIGHT_ONTOLOGY,
  agency: AGENCY_ONTOLOGY,
} as const;

export type PackId = keyof typeof CONSTANTS;

export function constantModel(packId: PackId): LivePackModel {
  const c = CONSTANTS[packId];
  return {
    source: "constant",
    packId,
    entities: [...c.entities],
    measures: c.measures.map((m) => ({ ...m })),
    vocabulary: { ...c.vocabulary },
    ruleIds: [...c.ruleIds],
  };
}

export async function liveModel(organizationId: string, packId: PackId): Promise<LivePackModel | null> {
  const prefix = `${packId}_`;
  const types = await listTypes(organizationId);
  const mine = types.filter((t) => t.key.startsWith(prefix));
  if (mine.length === 0) return null;
  const fallback = constantModel(packId);
  return {
    source: "live",
    packId,
    entities: mine.map((t) => t.key.slice(prefix.length)),
    measures: fallback.measures,
    vocabulary: fallback.vocabulary,
    ruleIds: fallback.ruleIds,
  };
}

export function liveReadsEnabled(): boolean {
  return process.env.ONTOLOGY_LIVE === "1";
}

export async function loadPackModel(organizationId: string, packId: PackId): Promise<LivePackModel> {
  if (liveReadsEnabled()) {
    const live = await liveModel(organizationId, packId).catch(() => null);
    if (live) return live;
  }
  return constantModel(packId);
}

export function modelsEqual(a: LivePackModel, b: LivePackModel): string[] {
  const diffs: string[] = [];
  const ae = [...a.entities].sort();
  const be = [...b.entities].sort();
  if (JSON.stringify(ae) !== JSON.stringify(be)) diffs.push(`entities differ: [${ae}] vs [${be}]`);
  const am = [...a.measures.map((m) => m.name)].sort();
  const bm = [...b.measures.map((m) => m.name)].sort();
  if (JSON.stringify(am) !== JSON.stringify(bm)) diffs.push("measures differ");
  if (JSON.stringify(a.vocabulary) !== JSON.stringify(b.vocabulary)) diffs.push("vocabulary differs");
  return diffs;
}
