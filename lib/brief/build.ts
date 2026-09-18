import type { WeeklyAnswer } from "@/lib/answers/service";

export interface BriefAnomaly {
  lane: string;
  swingPts: number;
  direction: "up" | "down";
  causes: string[];
}

export interface NewSince {
  lanes: string[];
  trucks: string[];
  brokers: string[];
}

export interface BriefContent {
  weekStart: string;
  weekEnd: string;
  totals: { revenue: number; cost: number; margin: number; marginPct: number | null; loads: number };
  prevTotals: { revenue: number; cost: number; margin: number; marginPct: number | null } | null;
  winners: Array<{ lane: string; margin: number }>;
  losers: Array<{ lane: string; margin: number }>;
  anomalies: BriefAnomaly[];
  openCorrections: number;
  newSince: NewSince;
  recentDecisions: Array<{ load: string; field: string; status: string; reason: string }>;
  paragraph: string;
  laneTotals: Record<string, { margin: number; marginPct: number | null }>;
}

export const DEFAULT_ANOMALY_PTS = 6;

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function buildBrief(
  current: WeeklyAnswer,
  prev: WeeklyAnswer | null,
  openCorrections: number,
  anomalyPts = DEFAULT_ANOMALY_PTS,
  newSince: NewSince = { lanes: [], trucks: [], brokers: [] },
  opts: { overrides?: Record<string, number>; suppressed?: string[]; recentDecisions?: BriefContent["recentDecisions"] } = {},
): BriefContent {
  const byMargin = [...current.lanes].sort((a, b) => a.margin - b.margin);
  const losers = byMargin.slice(0, 3).map((l) => ({ lane: l.lane, margin: l.margin }));
  const winners = [...byMargin].reverse().slice(0, 3).map((l) => ({ lane: l.lane, margin: l.margin }));

  const prevByLane = new Map((prev?.lanes ?? []).map((l) => [l.lane, l]));
  const anomalies: BriefAnomaly[] = [];
  const suppressed = new Set(opts.suppressed ?? []);
  for (const l of current.lanes) {
    if (suppressed.has(l.lane)) continue;
    const threshold = opts.overrides?.[l.lane] ?? anomalyPts;
    const p = prevByLane.get(l.lane);
    if (!p || l.marginPct === null || p.marginPct === null) continue;
    const swing = Math.round((l.marginPct - p.marginPct) * 100) / 100;
    if (Math.abs(swing) >= threshold) {
      const sorted = Object.entries(l.costByKind).sort((a, b) => b[1] - a[1]);
      const causes = sorted.slice(0, 2).map(([kind, amt]) => `${kind} ${money(amt)}`);
      const top = sorted[0];
      if (top && l.cost > 0 && top[1] / l.cost > 0.6) {
        causes.unshift(`dominated by ${top[0]}`);
      }
      anomalies.push({
        lane: l.lane,
        swingPts: swing,
        direction: swing >= 0 ? "up" : "down",
        causes,
      });
    }
  }
  anomalies.sort((a, b) => Math.abs(b.swingPts) - Math.abs(a.swingPts));

  const laneTotals: BriefContent["laneTotals"] = {};
  for (const l of current.lanes) laneTotals[l.lane] = { margin: l.margin, marginPct: l.marginPct };

  const t = current.totals;
  const parts = [
    `Week of ${current.meta.weekStart}: ${money(t.revenue)} revenue across ${t.loads} loads on ${current.lanes.length} lanes for ${money(t.margin)} margin${t.marginPct === null ? "" : ` (${t.marginPct}%)`}.`,
  ];
  if (winners[0]) parts.push(`Best lane ${winners[0].lane} (${money(winners[0].margin)}).`);
  if (losers[0]) parts.push(`Worst lane ${losers[0].lane} (${money(losers[0].margin)}).`);
  if (anomalies.length > 0) {
    parts.push(
      `${anomalies.length} lane${anomalies.length === 1 ? "" : "s"} moved more than ${anomalyPts}pts: ` +
        anomalies.map((a) => `${a.lane} ${a.direction} ${Math.abs(a.swingPts)}pts`).join("; ") +
        ".",
    );
  }
  if (openCorrections > 0) {
    parts.push(`${openCorrections} correction${openCorrections === 1 ? "" : "s"} still open.`);
  }
  const fresh: string[] = [];
  if (newSince.lanes.length > 0) fresh.push(`${newSince.lanes.length} new lane${newSince.lanes.length === 1 ? "" : "s"} (${newSince.lanes.slice(0, 3).join("; ")}${newSince.lanes.length > 3 ? "…" : ""})`);
  if (newSince.trucks.length > 0) fresh.push(`${newSince.trucks.length} new truck${newSince.trucks.length === 1 ? "" : "s"}`);
  if (newSince.brokers.length > 0) fresh.push(`${newSince.brokers.length} new broker${newSince.brokers.length === 1 ? "" : "s"}`);
  if (fresh.length > 0) parts.push(`New since last week: ${fresh.join(", ")}.`);

  return {
    weekStart: current.meta.weekStart,
    weekEnd: current.meta.weekEnd,
    totals: { revenue: t.revenue, cost: t.cost, margin: t.margin, marginPct: t.marginPct, loads: t.loads },
    prevTotals: prev
      ? { revenue: prev.totals.revenue, cost: prev.totals.cost, margin: prev.totals.margin, marginPct: prev.totals.marginPct }
      : null,
    winners,
    losers,
    anomalies,
    openCorrections,
    newSince,
    recentDecisions: opts.recentDecisions ?? [],
    paragraph: parts.join(" "),
    laneTotals,
  };
}
