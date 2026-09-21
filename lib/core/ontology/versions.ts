import type { Cardinality } from "@/lib/core/ontology/schema";

export interface TypeSnapshot {
  key: string;
  label: string;
  plural: string;
  description: string;
  properties: Array<{
    key: string;
    label: string;
    kind: string;
    required: boolean;
    unique: boolean;
    indexed: boolean;
    immutable: boolean;
    config?: Record<string, unknown>;
  }>;
}

export interface TypeDiff {
  added: string[];
  removed: string[];
  changed: Array<{ key: string; fields: string[] }>;
}

export function diffTypeSnapshots(oldSnap: TypeSnapshot, newSnap: TypeSnapshot): TypeDiff {
  const oldMap = new Map(oldSnap.properties.map((p) => [p.key, p]));
  const newMap = new Map(newSnap.properties.map((p) => [p.key, p]));
  const added = [...newMap.keys()].filter((k) => !oldMap.has(k));
  const removed = [...oldMap.keys()].filter((k) => !newMap.has(k));
  const changed: Array<{ key: string; fields: string[] }> = [];
  for (const [key, np] of newMap) {
    const op = oldMap.get(key);
    if (!op) continue;
    const fields: string[] = [];
    (["label", "kind", "required", "unique", "indexed", "immutable"] as const).forEach((f) => {
      if (JSON.stringify(op[f]) !== JSON.stringify(np[f])) fields.push(f);
    });
    if (JSON.stringify(op.config ?? null) !== JSON.stringify(np.config ?? null)) fields.push("config");
    if (fields.length > 0) changed.push({ key, fields });
  }
  return { added, removed, changed };
}

export interface MigrationStep {
  op: "add_property" | "drop_property" | "alter_property" | "rename_type" | "relabel";
  detail: string;
  destructive: boolean;
}

export function planMigration(diff: TypeDiff): MigrationStep[] {
  const steps: MigrationStep[] = [];
  for (const key of diff.added) {
    steps.push({ op: "add_property", detail: `add ${key} (backfill null/default)`, destructive: false });
  }
  for (const c of diff.changed) {
    const kindChanged = c.fields.includes("kind");
    steps.push({
      op: "alter_property",
      detail: `alter ${c.key}: ${c.fields.join(", ")}`,
      destructive: kindChanged,
    });
  }
  for (const key of diff.removed) {
    steps.push({ op: "drop_property", detail: `archive ${key} before drop`, destructive: true });
  }
  return steps;
}

export function checkCardinality(
  cardinality: Cardinality,
  existingCount: number
): { ok: boolean; error?: string } {
  if (cardinality === "one-one" && existingCount >= 1) {
    return { ok: false, error: "one-one link already has a target" };
  }
  return { ok: true };
}
