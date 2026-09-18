import type { AgencyAnswer } from "@/lib/packs/agency/service";
import { DEFAULT_ANOMALY_PTS, type BriefContent } from "@/lib/core/brief/content";
import { detectAnomalies, money, rankGroups } from "@/lib/core/brief/summary";

export type { BriefContent };
export { DEFAULT_ANOMALY_PTS };

export interface AgencyNewSince {
  projects: string[];
  clients: string[];
  team: string[];
}

export function buildAgencyBrief(
  current: AgencyAnswer,
  prev: AgencyAnswer | null,
  openCorrections: number,
  anomalyPts = DEFAULT_ANOMALY_PTS,
  newSince: AgencyNewSince = { projects: [], clients: [], team: [] },
  opts: { overrides?: Record<string, number>; suppressed?: string[]; recentDecisions?: BriefContent["recentDecisions"] } = {},
): BriefContent {
  const groups = current.projects.map((p) => ({
    key: p.project,
    margin: p.margin,
    marginPct: p.marginPct,
    cost: p.cost,
    costByKind: p.costByKind,
  }));
  const prevGroups = (prev?.projects ?? []).map((p) => ({
    key: p.project,
    margin: p.margin,
    marginPct: p.marginPct,
    cost: p.cost,
    costByKind: p.costByKind,
  }));
  const { winners: w, losers: l } = rankGroups(groups);
  const anomalies = detectAnomalies(groups, prevGroups, anomalyPts, opts.overrides, opts.suppressed);

  const t = current.totals;
  const rework = Math.round(
    current.projects.reduce((s, p) => s + (p.costByKind.labor ?? 0) + (p.costByKind.asset ?? 0), 0) * 100,
  ) / 100;
  const parts = [
    `Week of ${current.meta.weekStart}: ${money(t.revenue)} revenue across ${t.revisions} rounds on ${current.projects.length} projects for ${money(t.margin)} margin${t.marginPct === null ? "" : ` (${t.marginPct}%)`}.`,
  ];
  if (rework > 0) parts.push(`Rework labor and assets total ${money(rework)}.`);
  if (w[0]) parts.push(`Best project ${w[0].key} (${money(w[0].margin)}).`);
  if (l[0]) parts.push(`Worst project ${l[0].key} (${money(l[0].margin)}).`);
  if (anomalies.length > 0) {
    parts.push(
      `${anomalies.length} project${anomalies.length === 1 ? "" : "s"} moved more than ${anomalyPts}pts: ` +
        anomalies.map((a) => `${a.key} ${a.direction} ${Math.abs(a.swingPts)}pts`).join("; ") +
        ".",
    );
  }
  if (openCorrections > 0) {
    parts.push(`${openCorrections} correction${openCorrections === 1 ? "" : "s"} still open.`);
  }
  const fresh: string[] = [];
  if (newSince.projects.length > 0) fresh.push(`${newSince.projects.length} new project${newSince.projects.length === 1 ? "" : "s"} (${newSince.projects.slice(0, 3).join("; ")}${newSince.projects.length > 3 ? "…" : ""})`);
  if (newSince.clients.length > 0) fresh.push(`${newSince.clients.length} new client${newSince.clients.length === 1 ? "" : "s"}`);
  if (newSince.team.length > 0) fresh.push(`${newSince.team.length} new team member${newSince.team.length === 1 ? "" : "s"}`);
  if (fresh.length > 0) parts.push(`New since last week: ${fresh.join(", ")}.`);

  const laneTotals: BriefContent["laneTotals"] = {};
  for (const p of current.projects) laneTotals[p.project] = { margin: p.margin, marginPct: p.marginPct };

  return {
    schemaVersion: 1,
    weekStart: current.meta.weekStart,
    weekEnd: current.meta.weekEnd,
    totals: { revenue: t.revenue, cost: t.cost, margin: t.margin, marginPct: t.marginPct, loads: t.revisions },
    prevTotals: prev
      ? { revenue: prev.totals.revenue, cost: prev.totals.cost, margin: prev.totals.margin, marginPct: prev.totals.marginPct }
      : null,
    winners: w.map(({ key, margin }) => ({ lane: key, margin })),
    losers: l.map(({ key, margin }) => ({ lane: key, margin })),
    anomalies: anomalies.map((a) => ({ lane: a.key, swingPts: a.swingPts, direction: a.direction, causes: a.causes })),
    openCorrections,
    newSince: { lanes: newSince.projects, trucks: newSince.team, brokers: newSince.clients },
    recentDecisions: opts.recentDecisions ?? [],
    paragraph: parts.join(" "),
    laneTotals,
  };
}
