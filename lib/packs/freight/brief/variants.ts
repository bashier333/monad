import { buildBrief, type BriefContent, type NewSince } from "@/lib/packs/freight/brief/build";
import type { WeeklyAnswer } from "@/lib/packs/freight/service";
import { computeLaneMargins } from "@/lib/packs/freight/margin/engine";
import { getActiveCorrections, getInputs } from "@/lib/packs/freight/service";

export type VariantBy = "driver" | "truck" | "broker" | "customer" | "day" | "month";

export async function buildVariant(
  organizationId: string,
  weekStartsOn: number,
  anchorISO: string,
  by: VariantBy,
  key: string,
  openCorrections: number,
): Promise<BriefContent> {
  const inputs = await getInputs(organizationId);
  const corrections = await getActiveCorrections(organizationId);

  if (by === "month") {
    const weeks: WeeklyAnswer[] = [];
    const cursor = new Date(`${anchorISO}T00:00:00Z`);
    for (let w = 0; w < 4; w++) {
      const a = cursor.toISOString().slice(0, 10);
      const { weekBounds } = await import("@/lib/packs/freight/margin/engine");
      const { start, end } = weekBounds(a, weekStartsOn);
      const r = computeLaneMargins(inputs.loads, inputs.fuels, inputs.fees, inputs.aliases, corrections, start, end);
      weeks.push({ ...r, meta: { weekStart: start, weekEnd: end, currency: "USD", distanceUnit: "miles", engineVersion: "m", dataAsOf: inputs.dataAsOf } });
      cursor.setUTCDate(cursor.getUTCDate() - 7);
    }
    const merged = mergeAnswers(weeks);
    return buildBrief(merged, null, openCorrections, 6, { lanes: [], trucks: [], brokers: [] });
  }

  const filtered = { ...inputs, loads: filterLoads(inputs.loads, by, key) };
  const { weekBounds } = await import("@/lib/packs/freight/margin/engine");
  const { start, end } = weekBounds(anchorISO, weekStartsOn);
  const r = computeLaneMargins(filtered.loads, inputs.fuels, inputs.fees, inputs.aliases, corrections, start, end);
  const answer: WeeklyAnswer = {
    ...r,
    meta: { weekStart: start, weekEnd: end, currency: "USD", distanceUnit: "miles", engineVersion: "m", dataAsOf: inputs.dataAsOf },
  };
  const empty: NewSince = { lanes: [], trucks: [], brokers: [] };
  return buildBrief(answer, null, openCorrections, 6, empty);
}

function loadMatches(
  l: { driver: string; truck: string; broker: string; date: string },
  by: VariantBy,
  key: string,
): boolean {
  if (by === "driver") return l.driver.toLowerCase() === key.toLowerCase();
  if (by === "truck") return l.truck.toLowerCase() === key.toLowerCase();
  if (by === "broker" || by === "customer") return l.broker.toLowerCase() === key.toLowerCase();
  if (by === "day") return l.date === key;
  return true;
}

export function filterLoads<T extends { driver: string; truck: string; broker: string; date: string }>(
  loads: T[],
  by: VariantBy,
  key: string,
): T[] {
  return loads.filter((l) => loadMatches(l, by, key));
}

export function mergeAnswers(weeks: WeeklyAnswer[]): WeeklyAnswer {
  const first = weeks[0];
  const totals = { revenue: 0, cost: 0, margin: 0, marginPct: null as number | null, loads: 0 };
  const byLane = new Map<string, { revenue: number; cost: number; loads: number; loadKeys: string[]; costByKind: Record<string, number>; origin: string; destination: string }>();
  for (const w of weeks) {
    totals.revenue = Math.round((totals.revenue + w.totals.revenue) * 100) / 100;
    totals.cost = Math.round((totals.cost + w.totals.cost) * 100) / 100;
    totals.loads += w.totals.loads;
    for (const l of w.lanes) {
      const cur = byLane.get(l.lane) ?? { revenue: 0, cost: 0, loads: 0, loadKeys: [], costByKind: {}, origin: l.origin, destination: l.destination };
      cur.revenue = Math.round((cur.revenue + l.revenue) * 100) / 100;
      cur.cost = Math.round((cur.cost + l.cost) * 100) / 100;
      cur.loads += l.loads;
      cur.loadKeys.push(...l.loadKeys);
      for (const [k, v] of Object.entries(l.costByKind)) cur.costByKind[k] = Math.round(((cur.costByKind[k] ?? 0) + v) * 100) / 100;
      byLane.set(l.lane, cur);
    }
  }
  totals.margin = Math.round((totals.revenue - totals.cost) * 100) / 100;
  const lanes = [...byLane.entries()].map(([lane, v]) => ({
    lane,
    origin: v.origin,
    destination: v.destination,
    loads: v.loads,
    revenue: v.revenue,
    cost: v.cost,
    margin: Math.round((v.revenue - v.cost) * 100) / 100,
    marginPct: v.revenue === 0 ? null : (Math.round(((v.revenue - v.cost) / v.revenue) * 10000) / 100 as number | null),
    costByKind: v.costByKind,
    loadKeys: v.loadKeys,
    appliedRules: first.appliedRules,
  }));
  lanes.sort((a, b) => a.margin - b.margin);
  return { lanes, loads: [], totals, appliedRules: first.appliedRules, adjustments: [], meta: first.meta };
}
