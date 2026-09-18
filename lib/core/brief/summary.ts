export interface SummaryGroup {
  key: string;
  margin: number;
  marginPct: number | null;
  cost: number;
  costByKind: Record<string, number>;
}

export interface RankedItem {
  key: string;
  margin: number;
}

export interface SummaryAnomaly {
  key: string;
  swingPts: number;
  direction: "up" | "down";
  causes: string[];
}

export function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function rankGroups(groups: SummaryGroup[]): { winners: RankedItem[]; losers: RankedItem[] } {
  const byMargin = [...groups].sort((a, b) => a.margin - b.margin);
  return {
    losers: byMargin.slice(0, 3).map((g) => ({ key: g.key, margin: g.margin })),
    winners: [...byMargin].reverse().slice(0, 3).map((g) => ({ key: g.key, margin: g.margin })),
  };
}

export function detectAnomalies(
  current: SummaryGroup[],
  prev: SummaryGroup[],
  threshold: number,
  overrides: Record<string, number> = {},
  suppressed: string[] = [],
): SummaryAnomaly[] {
  const suppressedSet = new Set(suppressed);
  const prevByKey = new Map(prev.map((g) => [g.key, g]));
  const anomalies: SummaryAnomaly[] = [];
  for (const g of current) {
    if (suppressedSet.has(g.key)) continue;
    const limit = overrides[g.key] ?? threshold;
    const p = prevByKey.get(g.key);
    if (!p || g.marginPct === null || p.marginPct === null) continue;
    const swing = Math.round((g.marginPct - p.marginPct) * 100) / 100;
    if (Math.abs(swing) >= limit) {
      const sorted = Object.entries(g.costByKind).sort((a, b) => b[1] - a[1]);
      const causes = sorted.slice(0, 2).map(([kind, amt]) => `${kind} ${money(amt)}`);
      const top = sorted[0];
      if (top && g.cost > 0 && top[1] / g.cost > 0.6) {
        causes.unshift(`dominated by ${top[0]}`);
      }
      anomalies.push({ key: g.key, swingPts: swing, direction: swing >= 0 ? "up" : "down", causes });
    }
  }
  anomalies.sort((a, b) => Math.abs(b.swingPts) - Math.abs(a.swingPts));
  return anomalies;
}
