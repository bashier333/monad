// Blueprint validation L0 (structural) + L1 (referential) for the v1 JSON
// blueprint (see minimalist-mode-plan.md §6/W4.5). L0 checks the document
// shape the way a JSON Schema would; L1 checks that every reference resolves
// inside the same document (links → types, actions → types, policies →
// types). L2 (semantic: Cedar/Rego predicate check), L3 (dry-run plan +
// policy simulation), and L4 (round-trip canonical re-export diff = 0) run
// against live systems — L4 lives in scripts/mfg-e2e.ts, not here.
import type { buildPackManifest } from "@/lib/core/ontology/branch-store";

type Manifest = Awaited<ReturnType<typeof buildPackManifest>>;

export interface BlueprintProblem {
  level: "L0" | "L1";
  path: string;
  message: string;
}

const CARDINALITIES = new Set(["one-one", "one-many", "many-many"]);
const APPROVALS = new Set(["none", "single", "quorum"]);

export function validateBlueprint(manifest: Manifest): { ok: boolean; problems: BlueprintProblem[] } {
  const problems: BlueprintProblem[] = [];
  if (manifest.version !== 2) {
    problems.push({ level: "L0", path: "version", message: `unsupported manifest version ${manifest.version}, expected 2` });
  }
  if (!manifest.exportedAt || Number.isNaN(Date.parse(manifest.exportedAt))) {
    problems.push({ level: "L0", path: "exportedAt", message: "exportedAt must be an ISO timestamp" });
  }
  const typeKeys = new Set<string>();
  for (const t of manifest.types) {
    if (!t.key || !/^[a-z][a-z0-9_]{1,63}$/.test(t.key)) {
      problems.push({ level: "L0", path: `types.${t.key || "?"}`, message: "type key must match [a-z][a-z0-9_]{1,63}" });
      continue;
    }
    if (typeKeys.has(t.key)) problems.push({ level: "L0", path: `types.${t.key}`, message: "duplicate type key" });
    typeKeys.add(t.key);
    const propKeys = new Set<string>();
    for (const p of t.properties) {
      if (!p.key) {
        problems.push({ level: "L0", path: `types.${t.key}.properties`, message: "property key is required" });
        continue;
      }
      if (propKeys.has(p.key)) problems.push({ level: "L0", path: `types.${t.key}.${p.key}`, message: "duplicate property key" });
      propKeys.add(p.key);
      if (!p.kind) problems.push({ level: "L0", path: `types.${t.key}.${p.key}`, message: "property kind is required" });
    }
  }
  for (const l of manifest.links) {
    if (!CARDINALITIES.has(l.cardinality)) {
      problems.push({ level: "L0", path: `links.${l.key}`, message: `cardinality must be one of ${[...CARDINALITIES].join("|")}` });
    }
    if (!typeKeys.has(l.fromTypeKey)) {
      problems.push({ level: "L1", path: `links.${l.key}`, message: `fromTypeKey ${l.fromTypeKey} does not exist` });
    }
    if (!typeKeys.has(l.toTypeKey)) {
      problems.push({ level: "L1", path: `links.${l.key}`, message: `toTypeKey ${l.toTypeKey} does not exist` });
    }
  }
  for (const a of manifest.actions) {
    if (!typeKeys.has(a.targetTypeKey)) {
      problems.push({ level: "L1", path: `actions.${a.key}`, message: `targetTypeKey ${a.targetTypeKey} does not exist` });
    }
    if (!APPROVALS.has(a.approvalPolicy)) {
      problems.push({ level: "L0", path: `actions.${a.key}`, message: `approvalPolicy must be one of ${[...APPROVALS].join("|")}` });
    }
    const effects = (a.effects as Array<{ kind?: string }> | null) ?? [];
    if (!Array.isArray(effects) || effects.length === 0) {
      problems.push({ level: "L0", path: `actions.${a.key}`, message: "at least one effect is required" });
    }
  }
  for (const p of manifest.policies) {
    if (!typeKeys.has(p.typeKey)) {
      problems.push({ level: "L1", path: `policies.${p.typeKey}`, message: `typeKey ${p.typeKey} does not exist` });
    }
    if (p.effect !== "allow" && p.effect !== "deny") {
      problems.push({ level: "L0", path: `policies.${p.typeKey}`, message: "effect must be allow|deny" });
    }
  }
  return { ok: problems.length === 0, problems };
}
