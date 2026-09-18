import type { WeeklyAnswer } from "@/lib/packs/freight/service";
import { detectAnomalies, money, rankGroups } from "@/lib/core/brief/summary";
import type { BriefAnomaly, BriefContent, NewSince } from "@/lib/core/brief/content";
import { DEFAULT_ANOMALY_PTS } from "@/lib/core/brief/content";

export type { BriefAnomaly, BriefContent, NewSince };
export { DEFAULT_ANOMALY_PTS };

export function buildBrief(
  current: WeeklyAnswer,
  prev: WeeklyAnswer | null,
  openCorrections: number,
  anomalyPts = DEFAULT_ANOMALY_PTS,
  newSince: NewSince = { lanes: [], trucks: [], brokers: [] },
  opts: { overrides?: Record<string, number>; suppressed?: string[]; recentDecisions?: BriefContent["recentDecisions"] } = {},
): BriefContent {
  const { winners: w, losers: l } = rankGroups(current.lanes.map((x) => ({ ...x, key: x.lane })));
  const winners = w.map(({ key, margin }) => ({ lane: key, margin }));
  const losers = l.map(({ key, margin }) => ({ lane: key, margin }));
  const anomalies = detectAnomalies(
    current.lanes.map((x) => ({ ...x, key: x.lane })),
    (prev?.lanes ?? []).map((x) => ({ ...x, key: x.lane })),
    anomalyPts,
    opts.overrides,
    opts.suppressed,
  ).map((a) => ({ lane: a.key, swingPts: a.swingPts, direction: a.direction, causes: a.causes }));

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
    schemaVersion: 1,
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
