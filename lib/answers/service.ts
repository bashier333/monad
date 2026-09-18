import {
  computeLaneMargins,
  CURRENCY,
  DISTANCE_UNIT,
  ENGINE_VERSION,
  toISODate,
  weekBounds,
  type AppliedCorrection,
  type EngineResult,
  type FeeInput,
  type FuelInput,
  type LoadInput,
} from "@/lib/margin/engine";
import { seedAliases } from "@/lib/margin/places";
import { laneKey, normalizePlace } from "@/lib/margin/places";
import { correctionFromRow, expandRule, type MatchableLoad } from "@/lib/corrections/rules";
import { cacheBust, cacheGet, cacheSet } from "@/lib/cache";
import { db } from "@/lib/db";

export interface AnswerMeta {
  weekStart: string;
  weekEnd: string;
  currency: string;
  distanceUnit: string;
  engineVersion: string;
  dataAsOf: Date | null;
}

export async function getAliases(organizationId: string): Promise<Map<string, string>> {
  const cached = cacheGet<Array<{ alias: string; canonical: string }>>(`aliases:${organizationId}`);
  const rows = cached ?? (await db.placeAlias.findMany({ where: { organizationId } }));
  if (!cached) cacheSet(`aliases:${organizationId}`, rows, 60_000);
  const aliases = seedAliases();
  for (const a of rows) aliases.set(a.alias, a.canonical);
  return aliases;
}

export function bustAliasCache(organizationId: string): void {
  cacheBust(`aliases:${organizationId}`);
}

export interface WeeklyAnswer extends EngineResult {
  meta: AnswerMeta;
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
    where: { organizationId, status: "ok", run: { status: "COMPLETED" } },
    include: { run: { select: { id: true, sourceType: true, file: { select: { filename: true } } } } },
    take: 200_000,
  });

  const aliases = await getAliases(organizationId);

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

  const aliases = await getAliases(organizationId);
  const staged = await db.stagedRecord.findMany({
    where: { organizationId, status: "ok", run: { status: "COMPLETED" } },
    select: { loadKey: true, data: true },
    take: 200_000,
  });
  const matchable: MatchableLoad[] = staged.map((s) => {
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
  const cacheKey = `answer:${organizationId}:${start}:${asOf}`;
  const cached = cacheGet<WeeklyAnswer>(cacheKey);
  if (cached) return cached;
  const full = buildAnswer(inputs, corrections, start, end);
  if (full.loads.length <= 5000) cacheSet(cacheKey, full, 60_000);
  return full;
}

export function bustAnswerCache(organizationId: string): void {
  cacheBust(`answer:${organizationId}:`);
}

export function resolveWeek(weekParam: string | null): string {
  const anchor = weekParam ? toISODate(weekParam) : toISODate(new Date().toISOString().slice(0, 10));
  if (!anchor) throw new Error("invalid week parameter (use YYYY-MM-DD)");
  return anchor;
}
