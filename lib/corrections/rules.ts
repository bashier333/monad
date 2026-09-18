import type { AppliedCorrection } from "@/lib/margin/engine";

export interface MatchableLoad {
  loadKey: string;
  driver: string;
  origin: string;
  destination: string;
  broker: string;
  truck: string;
  lane: string;
  date: string;
  revenue: string;
  miles: string;
}

function matchValue(load: MatchableLoad, field: string, want: string): boolean {
  const w = want.trim();
  if (field === "date" && (/^[<>]=?/.test(w) || w.startsWith("="))) {
    const m = w.match(/^([<>]=?|=)(.+)$/);
    if (!m) return false;
    const a = Date.parse(load.date);
    const b = Date.parse(m[2].trim());
    if (Number.isNaN(a) || Number.isNaN(b)) return false;
    if (m[1] === ">") return a > b;
    if (m[1] === ">=") return a >= b;
    if (m[1] === "<") return a < b;
    if (m[1] === "<=") return a <= b;
    return a === b;
  }
  if ((field === "revenue" || field === "miles") && /^[<>]=?/.test(w)) {
    const m = w.match(/^([<>]=?)(.+)$/);
    if (!m) return false;
    const a = Number(String(load[field as "revenue" | "miles"]).replace(/[$,]/g, ""));
    const b = Number(m[2].trim().replace(/[$,]/g, ""));
    if (Number.isNaN(a) || Number.isNaN(b)) return false;
    if (m[1] === ">") return a > b;
    if (m[1] === ">=") return a >= b;
    if (m[1] === "<") return a < b;
    return a <= b;
  }
  const v = (load[field as keyof MatchableLoad] ?? "").toLowerCase();
  return v !== "" && v === w.toLowerCase();
}

export interface RuleInput {
  kind: string;
  costKind: string;
  matchField: string;
  matchValue: string;
  toLoad: string | null;
  reason: string;
}

export function expandRule(
  rule: { id: string } & RuleInput,
  loads: MatchableLoad[],
): AppliedCorrection[] {
  if (rule.kind !== "reattribute" || !rule.costKind || !rule.matchField || !rule.matchValue) return [];
  const want = rule.matchValue.trim();
  return loads
    .filter((l) => matchValue(l, rule.matchField, want))
    .map((l) => ({
      id: `rule:${rule.id}`,
      costKind: rule.costKind,
      fromLoad: l.loadKey,
      toLoad: rule.toLoad,
      reason: rule.reason || `standing rule ${rule.id}`,
    }));
}

export function correctionFromRow(row: {
  id: string;
  field: string;
  targetKey: string;
  newValue: string;
  reason: string;
}): AppliedCorrection {
  return {
    id: `corr:${row.id}`,
    costKind: row.field,
    fromLoad: row.targetKey,
    toLoad: row.newValue === "EXCLUDE" || row.newValue === "" ? null : row.newValue,
    reason: row.reason,
  };
}
