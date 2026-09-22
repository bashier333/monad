import type { PropertyKind } from "@/lib/core/ontology/kinds";

// Per-kind coercion telemetry for the governed write path (objects.ts).
// In-memory and per-instance by design: the exe runs single-instance, and
// the hot path must never block on a meter write. Ops reads the summary;
// tests assert the accounting. NOT a billing meter (see MeterEvent).

export interface KindOutcome {
  ok: number;
  fail: number;
}

const counts = new Map<string, KindOutcome>();
const MAX_KEYS = 2000;

export function recordKindOutcome(orgId: string, kind: PropertyKind, ok: boolean): void {
  const k = `${orgId}::${kind}`;
  if (!counts.has(k) && counts.size >= MAX_KEYS) return;
  const cur = counts.get(k) ?? { ok: 0, fail: 0 };
  if (ok) cur.ok++;
  else cur.fail++;
  counts.set(k, cur);
}

export function kindErrorRates(orgId: string): Array<{ kind: string; ok: number; fail: number; failRate: number }> {
  const out: Array<{ kind: string; ok: number; fail: number; failRate: number }> = [];
  for (const [k, v] of counts) {
    const [org, kind] = k.split("::");
    if (org !== orgId) continue;
    const total = v.ok + v.fail;
    out.push({ kind, ok: v.ok, fail: v.fail, failRate: total === 0 ? 0 : v.fail / total });
  }
  return out.sort((a, b) => b.failRate - a.failRate);
}

export function resetKindTelemetry(): void {
  counts.clear();
}
