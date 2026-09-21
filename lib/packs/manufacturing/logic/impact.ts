import { lotCoverage } from "@/lib/packs/manufacturing/logic/coverage";
import type { LotLite } from "@/lib/packs/manufacturing/logic/reorder";

export interface ImpactSnapshot {
  avgCoverage: number | null;
  atRisk: number;
}

export interface ImpactResult {
  before: ImpactSnapshot;
  after: ImpactSnapshot;
  affected: number;
}

function snapshot(lots: LotLite[]): ImpactSnapshot {
  let coverageSum = 0;
  let coverageCount = 0;
  let atRisk = 0;
  for (const lot of lots) {
    const c = lotCoverage(lot.data);
    if (c.coverageDays !== null && Number.isFinite(c.coverageDays)) {
      coverageSum += c.coverageDays;
      coverageCount += 1;
    }
    if (c.belowReorderPoint) atRisk += 1;
  }
  return { avgCoverage: coverageCount === 0 ? null : Math.round((coverageSum / coverageCount) * 10) / 10, atRisk };
}

// What-if simulation over the lot graph. Changes use the same shape branch
// staging persists (objectId + merged data), so a simulated state can be
// staged as a scenario and merged back through the branches API.
export function impactSimulation(
  lots: LotLite[],
  changes: Array<{ objectId: string; data: Record<string, unknown> }>
): ImpactResult {
  const byId = new Map(lots.map((l) => [l.id, l]));
  const before = snapshot(lots);
  const simulated: LotLite[] = lots.map((l) => ({ ...l, data: { ...l.data } }));
  let affected = 0;
  for (const change of changes) {
    const lot = byId.get(change.objectId);
    if (!lot) continue;
    affected += 1;
    const target = simulated.find((l) => l.id === change.objectId);
    if (!target) continue;
    target.data = { ...target.data, ...change.data };
  }
  const after = snapshot(simulated);
  return { before, after, affected };
}
