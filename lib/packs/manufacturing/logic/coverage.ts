export interface CoverageResult {
  coverageDays: number | null;
  belowReorderPoint: boolean;
}

export function coverageDays(qty_on_hand: number, daily_demand: number): number | null {
  if (!Number.isFinite(qty_on_hand) || !Number.isFinite(daily_demand)) return null;
  if (daily_demand <= 0) return qty_on_hand > 0 ? Infinity : 0;
  return Math.max(0, Math.round((qty_on_hand / daily_demand) * 10) / 10);
}

export function lotCoverage(lot: { qty_on_hand: number; reorder_point?: number | null; daily_demand?: number | null }): CoverageResult {
  const coverage = lot.daily_demand === undefined || lot.daily_demand === null ? null : coverageDays(lot.qty_on_hand, lot.daily_demand);
  const reorder = lot.reorder_point ?? null;
  return {
    coverageDays: coverage,
    belowReorderPoint: reorder !== null && lot.qty_on_hand < reorder,
  };
}
