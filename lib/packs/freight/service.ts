import {
  computeLaneMargins,
  CURRENCY,
  DISTANCE_UNIT,
  ENGINE_VERSION,
  weekBounds,
  type EngineResult,
  type FeeInput,
  type FuelInput,
  type LoadInput,
} from "@/lib/packs/freight/margin/engine";
import { seedAliases } from "@/lib/packs/freight/margin/places";
import { laneKey, normalizePlace } from "@/lib/packs/freight/margin/places";
import {
  correctionFromRow,
  expandRule,
  type AppliedCorrection,
  type MatchableRecord,
} from "@/lib/core/corrections/rules";
import { FREIGHT_FIELD_KINDS } from "@/lib/packs/freight/margin/rules";
import { cacheGet, cacheSet } from "@/lib/core/cache";
import { db } from "@/lib/core/db";
import {
  getAliases,
  type AnswerMeta,
} from "@/lib/core/answers/service";

const FREIGHT_TYPES = ["tms", "fuel", "broker", "manual"];

export interface WeeklyAnswer extends EngineResult {
  meta: AnswerMeta;
  forecasts?: Array<{ lane: string; point: number; lo: number; high: number; mape: number; drivers: string[] }>;
}

interface Inputs {
  loads: LoadInput[];
  fuels: FuelInput[];
  fees: FeeInput[];
  aliases: Map<string, string>;
  dataAsOf: Date | null;
}

export async function getInputs(organizationId: string): Promise<Inputs> {
  const staged = await db.stagedRecord.findMany({
    where: {
      organizationId,
      status: "ok",
      run: { status: "COMPLETED", sourceType: { in: FREIGHT_TYPES } },
    },
    include: { run: { select: { id: true, sourceType: true, file: { select: { filename: true } } } } },
    take: 200_000,
  });

  const aliases = await getAliases(organizationId, seedAliases());

  const loads: LoadInput[] = [];
  const fuels: FuelInput[] = [];
  const fees: FeeInput[] = [];
  for (const s of staged) {
    const d = s.data as Record<string, string>;
    if (s.run.sourceType === "fuel") {
      fuels.push({ truck: d.truck ?? "", date: d.date ?? "", amount: d.amount ?? "", runId: s.run.id, fileName: s.run.file.filename, rowNumber: s.rowNumber });
    } else if (s.run.sourceType === "broker") {
      fees.push({ loadKey: d.loadId ?? "", fee: d.fee ?? "", runId: s.run.id, fileName: s.run.file.filename, rowNumber: s.rowNumber });
    } else {
      loads.push({
        loadKey: s.loadKey ?? d.loadId ?? "",
        date: d.date ?? "",
        origin: d.origin ?? "",
        destination: d.destination ?? "",
        driver: d.driver ?? "",
        truck: d.truck ?? "",
        broker: d.broker ?? "",
        revenue: d.revenue ?? "",
        miles: d.miles ?? "",
        detention: d.detention ?? "",
        runId: s.run.id,
        fileName: s.run.file.filename,
        rowNumber: s.rowNumber,
      });
    }
  }

  const latest = await db.stagedRecord.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  return { loads, fuels, fees, aliases, dataAsOf: latest?.createdAt ?? null };
}

export async function getActiveCorrections(organizationId: string): Promise<AppliedCorrection[]> {
  const [corrections, rules] = await Promise.all([
    db.correction.findMany({ where: { organizationId, status: "applied" } }),
    db.standingRule.findMany({ where: { organizationId, active: true } }),
  ]);
  const out = corrections.map(correctionFromRow);
  if (rules.length === 0) return out;

  const aliases = await getAliases(organizationId, seedAliases());
  const staged = await db.stagedRecord.findMany({
    where: {
      organizationId,
      status: "ok",
      run: { status: "COMPLETED", sourceType: { in: FREIGHT_TYPES } },
    },
    select: { loadKey: true, data: true },
    take: 200_000,
  });
  const matchable: MatchableRecord[] = staged.map((s) => {
    const d = s.data as Record<string, string>;
    const origin = d.origin ?? "";
    const destination = d.destination ?? "";
    return {
      loadKey: s.loadKey ?? d.loadId ?? "",
      driver: d.driver ?? "",
      origin,
      destination,
      broker: d.broker ?? "",
      truck: d.truck ?? "",
      lane: origin && destination ? laneKey(normalizePlace(origin, aliases), normalizePlace(destination, aliases)) : "",
      date: d.date ?? "",
      revenue: d.revenue ?? "",
      miles: d.miles ?? "",
    };
  });
  for (const r of rules) {
    out.push(
      ...expandRule(
        { id: r.id, kind: r.kind, costKind: r.costKind, matchField: r.matchField, matchValue: r.matchValue, toLoad: r.toLoad, reason: r.reason },
        matchable,
        FREIGHT_FIELD_KINDS,
      ),
    );
  }
  return out;
}

export function buildAnswer(
  inputs: Inputs,
  corrections: AppliedCorrection[],
  weekStart: string,
  weekEnd: string,
): WeeklyAnswer {
  const result = computeLaneMargins(inputs.loads, inputs.fuels, inputs.fees, inputs.aliases, corrections, weekStart, weekEnd);
  return {
    ...result,
    meta: {
      weekStart,
      weekEnd,
      currency: CURRENCY,
      distanceUnit: DISTANCE_UNIT,
      engineVersion: ENGINE_VERSION,
      dataAsOf: inputs.dataAsOf,
    },
  };
}

export async function getWeeklyAnswer(
  organizationId: string,
  weekStartsOn: number,
  anchorISO: string,
): Promise<WeeklyAnswer> {
  const { start, end } = weekBounds(anchorISO, weekStartsOn);
  const [inputs, corrections] = await Promise.all([
    getInputs(organizationId),
    getActiveCorrections(organizationId),
  ]);
  const asOf = inputs.dataAsOf?.toISOString() ?? "none";
  const cacheKey = `answer:freight:${organizationId}:${start}:${asOf}`;
  const cached = cacheGet<WeeklyAnswer>(cacheKey);
  if (cached) return cached;
  const full = buildAnswer(inputs, corrections, start, end);
  if (full.loads.length <= 5000) cacheSet(cacheKey, full, 60_000);
  return full;
}

export async function getFreightForecast(
  organizationId: string,
  weekStartsOn: number,
  anchorISO: string,
): Promise<Array<{ lane: string; point: number; lo: number; high: number; mape: number; drivers: string[] }>> {
  const { linearForecast, forecastBands, backtestForecast, explainForecast } = await import("@/lib/core/predict");
  const cursor = new Date(`${anchorISO}T00:00:00Z`);
  const perLane = new Map<string, Array<{ weekStart: string; margin: number }>>();
  for (let w = 0; w < 6; w++) {
    const a = cursor.toISOString().slice(0, 10);
    const answer = await getWeeklyAnswer(organizationId, weekStartsOn, a);
    for (const l of answer.lanes) {
      const list = perLane.get(l.lane) ?? [];
      list.push({ weekStart: a, margin: l.margin });
      perLane.set(l.lane, list);
    }
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }
  const out: Array<{ lane: string; point: number; lo: number; high: number; mape: number; drivers: string[] }> = [];
  for (const [lane, history] of perLane) {
    const ordered = [...history].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
    if (ordered.length < 2) continue;
    const f = linearForecast(ordered);
    const bands = forecastBands(f, ordered);
    const m = backtestForecast(ordered);
    const e = explainForecast(f, ordered);
    out.push({ lane, point: f.point, lo: bands.lo, high: bands.high, mape: m, drivers: e.drivers });
  }
  return out.sort((a, b) => a.point - b.point);
}
