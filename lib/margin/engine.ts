import { laneKey, normalizePlace } from "@/lib/margin/places";
import { RULES, type RuleDef } from "@/lib/margin/rules";

export const ENGINE_VERSION = "m1";
export const CURRENCY = "USD";
export const DISTANCE_UNIT = "miles";

export interface LoadInput {
  loadKey: string;
  date: string;
  origin: string;
  destination: string;
  driver: string;
  truck: string;
  broker: string;
  revenue: string;
  miles: string;
  detention: string;
  runId: string;
  fileName: string;
  rowNumber: number;
}

export interface FuelInput {
  truck: string;
  date: string;
  amount: string;
  runId: string;
  fileName: string;
  rowNumber: number;
}

export interface FeeInput {
  loadKey: string;
  fee: string;
  runId: string;
  fileName: string;
  rowNumber: number;
}

export interface CostSource {
  runId: string;
  fileName: string;
  rowNumbers: number[];
}

export interface CostLine {
  kind: "detention" | "fee" | "fuel" | "adjustment";
  label: string;
  amount: number;
  ruleId: string;
  source: CostSource;
}

export interface LoadMargin {
  loadKey: string;
  date: string;
  origin: string;
  destination: string;
  driver: string;
  truck: string;
  broker: string;
  revenue: number;
  miles: number;
  costs: CostLine[];
  totalCost: number;
  margin: number;
  marginPct: number | null;
}

export interface LaneMargin {
  lane: string;
  origin: string;
  destination: string;
  loads: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number | null;
  costByKind: Record<string, number>;
  loadKeys: string[];
  appliedRules: RuleDef[];
}

export interface AppliedCorrection {
  id: string;
  costKind: string;
  fromLoad: string;
  toLoad: string | null;
  reason: string;
}

export function parseMoney(v: string): number {
  if (!v) return 0;
  const n = Number(v.replace(/[$,\s]/g, ""));
  return Number.isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

export function toISODate(s: string): string | null {
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

export function weekBounds(anyDayISO: string, weekStartsOn: number): { start: string; end: string } {
  const d = new Date(`${anyDayISO}T00:00:00Z`);
  const dow = d.getUTCDay();
  const back = (dow - weekStartsOn + 7) % 7;
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - back);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const fmt = (x: Date) => x.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

function pct(margin: number, revenue: number): number | null {
  if (revenue === 0) return null;
  return Math.round((margin / revenue) * 10000) / 100;
}

export interface EngineResult {
  lanes: LaneMargin[];
  loads: LoadMargin[];
  totals: { revenue: number; cost: number; margin: number; marginPct: number | null; loads: number };
  appliedRules: RuleDef[];
  adjustments: Array<{ correctionId: string; description: string }>;
}

export function computeLaneMargins(
  loads: LoadInput[],
  fuels: FuelInput[],
  fees: FeeInput[],
  aliases: Map<string, string>,
  corrections: AppliedCorrection[],
  weekStart: string,
  weekEnd: string,
): EngineResult {
  const inWeek = loads.filter((l) => {
    const d = toISODate(l.date);
    return d !== null && d >= weekStart && d <= weekEnd;
  });

  const byLoad = new Map<string, LoadMargin>();
  for (const l of inWeek) {
    const origin = normalizePlace(l.origin, aliases);
    const destination = normalizePlace(l.destination, aliases);
    const revenue = parseMoney(l.revenue);
    const detention = parseMoney(l.detention);
    const costs: CostLine[] = [];
    if (detention !== 0) {
      costs.push({
        kind: "detention",
        label: "Detention",
        amount: detention,
        ruleId: "R-det-1",
        source: { runId: l.runId, fileName: l.fileName, rowNumbers: [l.rowNumber] },
      });
    }
    byLoad.set(l.loadKey, {
      loadKey: l.loadKey,
      date: toISODate(l.date) ?? l.date,
      origin,
      destination,
      driver: l.driver,
      truck: l.truck,
      broker: l.broker,
      revenue,
      miles: parseMoney(l.miles),
      costs,
      totalCost: 0,
      margin: 0,
      marginPct: null,
    });
  }

  for (const f of fees) {
    const target = byLoad.get(f.loadKey);
    if (!target) continue;
    const amount = parseMoney(f.fee);
    if (amount === 0) continue;
    target.costs.push({
      kind: "fee",
      label: "Broker/factor fee",
      amount,
      ruleId: "R-fee-1",
      source: { runId: f.runId, fileName: f.fileName, rowNumbers: [f.rowNumber] },
    });
  }

  const fuelByTruck = new Map<string, { amount: number; sources: CostSource }>();
  for (const f of fuels) {
    const d = toISODate(f.date);
    if (d === null || d < weekStart || d > weekEnd) continue;
    const truck = f.truck.trim();
    if (!truck) continue;
    const amount = parseMoney(f.amount);
    if (amount === 0) continue;
    const cur = fuelByTruck.get(truck) ?? {
      amount: 0,
      sources: { runId: f.runId, fileName: f.fileName, rowNumbers: [] },
    };
    cur.amount = Math.round((cur.amount + amount) * 100) / 100;
    cur.sources.rowNumbers.push(f.rowNumber);
    fuelByTruck.set(truck, cur);
  }

  const loadsByTruck = new Map<string, LoadMargin[]>();
  for (const lm of byLoad.values()) {
    const list = loadsByTruck.get(lm.truck) ?? [];
    list.push(lm);
    loadsByTruck.set(lm.truck, list);
  }
  for (const [truck, bucket] of fuelByTruck) {
    const truckLoads = (loadsByTruck.get(truck) ?? []).filter((l) => l.miles >= 0);
    if (truckLoads.length === 0) continue;
    const totalMiles = truckLoads.reduce((s, l) => s + l.miles, 0);
    for (const lm of truckLoads) {
      const share =
        totalMiles > 0 ? bucket.amount * (lm.miles / totalMiles) : bucket.amount / truckLoads.length;
      const amount = Math.round(share * 100) / 100;
      if (amount === 0) continue;
      lm.costs.push({
        kind: "fuel",
        label: `Fuel (${truck})`,
        amount,
        ruleId: "R-fuel-1",
        source: bucket.sources,
      });
    }
  }

  const adjustments: EngineResult["adjustments"] = [];
  for (const c of corrections) {
    const from = byLoad.get(c.fromLoad);
    if (!from) continue;
    const idx = from.costs.findIndex((cl) => cl.kind === c.costKind);
    if (idx === -1) continue;
    const [line] = from.costs.splice(idx, 1);
    let dest: string | null = c.toLoad;
    let pct = 1;
    if (dest && dest.includes(":")) {
      const [target, share] = dest.split(":");
      const p = Number(share);
      if (!target || Number.isNaN(p) || p <= 0 || p >= 100) {
        from.costs.push(line);
        continue;
      }
      dest = target;
      pct = p / 100;
    }
    if (dest) {
      const to = byLoad.get(dest);
      if (to) {
        const moved = Math.round(line.amount * pct * 100) / 100;
        const left = Math.round((line.amount - moved) * 100) / 100;
        to.costs.push({ ...line, amount: moved, ruleId: `corr:${c.id}` });
        if (left > 0) from.costs.push({ ...line, amount: left });
        adjustments.push({ correctionId: c.id, description: `moved ${c.costKind} $${moved} from ${c.fromLoad} to ${dest}: ${c.reason}` });
      } else {
        from.costs.push(line);
        continue;
      }
    } else {
      adjustments.push({ correctionId: c.id, description: `excluded ${c.costKind} $${line.amount} from ${c.fromLoad}: ${c.reason}` });
    }
  }

  const laneMap = new Map<string, LaneMargin>();
  const ruleIds = new Set<string>(["R-rev-1", "R-scope-1"]);
  for (const lm of byLoad.values()) {
    lm.totalCost = Math.round(lm.costs.reduce((s, c) => s + c.amount, 0) * 100) / 100;
    lm.margin = Math.round((lm.revenue - lm.totalCost) * 100) / 100;
    lm.marginPct = pct(lm.margin, lm.revenue);
    for (const c of lm.costs) ruleIds.add(c.ruleId.startsWith("corr:") ? "corr" : c.ruleId);

    const key = laneKey(lm.origin, lm.destination);
    let lane = laneMap.get(key);
    if (!lane) {
      lane = {
        lane: key,
        origin: lm.origin,
        destination: lm.destination,
        loads: 0,
        revenue: 0,
        cost: 0,
        margin: 0,
        marginPct: null,
        costByKind: {},
        loadKeys: [],
        appliedRules: [],
      };
      laneMap.set(key, lane);
    }
    lane.loads++;
    lane.revenue = Math.round((lane.revenue + lm.revenue) * 100) / 100;
    lane.cost = Math.round((lane.cost + lm.totalCost) * 100) / 100;
    lane.loadKeys.push(lm.loadKey);
    for (const c of lm.costs) {
      lane.costByKind[c.kind] = Math.round(((lane.costByKind[c.kind] ?? 0) + c.amount) * 100) / 100;
    }
  }

  const lanes = [...laneMap.values()].map((l) => ({
    ...l,
    loadKeys: [...l.loadKeys].sort(),
    costByKind: Object.fromEntries(Object.entries(l.costByKind).sort(([a], [b]) => (a < b ? -1 : 1))),
    margin: Math.round((l.revenue - l.cost) * 100) / 100,
    marginPct: pct(Math.round((l.revenue - l.cost) * 100) / 100, l.revenue),
  }));
  lanes.sort((a, b) => a.margin - b.margin);

  const totals = {
    revenue: Math.round(lanes.reduce((s, l) => s + l.revenue, 0) * 100) / 100,
    cost: Math.round(lanes.reduce((s, l) => s + l.cost, 0) * 100) / 100,
    margin: 0,
    marginPct: null as number | null,
    loads: lanes.reduce((s, l) => s + l.loads, 0),
  };
  totals.margin = Math.round((totals.revenue - totals.cost) * 100) / 100;
  totals.marginPct = pct(totals.margin, totals.revenue);

  const appliedRules = [...ruleIds]
    .filter((id) => id !== "corr")
    .map((id) => RULES[id])
    .filter(Boolean);
  if (ruleIds.has("corr")) {
    appliedRules.push({ id: "corr", sentence: "Human corrections applied (see adjustments)." });
  }

  return { lanes, loads: [...byLoad.values()], totals, appliedRules, adjustments };
}
