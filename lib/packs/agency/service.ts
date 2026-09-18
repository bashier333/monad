import {
  computeProjectMargins,
  AGENCY_CURRENCY,
  AGENCY_ENGINE_VERSION,
  weekBounds,
  type AgencyFee,
  type AgencyInput,
  type AgencyInvoice,
  type AgencyAsset,
  type AgencyResult,
} from "@/lib/packs/agency/engine";
import { seedAgencyAliases } from "@/lib/packs/agency/places";
import { joinAgencyByProject, type HourConflict } from "@/lib/packs/agency/merge";
import {
  correctionFromRow,
  expandRule,
  type AppliedCorrection,
  type MatchableRecord,
} from "@/lib/core/corrections/rules";
import { AGENCY_FIELD_KINDS } from "@/lib/packs/agency/rules";
import { AGENCY_SOURCE_TYPES } from "@/lib/packs/agency/sources";
import { cacheGet, cacheSet } from "@/lib/core/cache";
import { db } from "@/lib/core/db";
import {
  bustAnswerCache,
  getAliases,
  type AnswerMeta,
} from "@/lib/core/answers/service";

export interface AgencyAnswer extends AgencyResult {
  meta: AnswerMeta;
  joinConflicts: HourConflict[];
}

void bustAnswerCache;

interface AgencyInputs {
  records: AgencyInput[];
  assets: AgencyAsset[];
  fees: AgencyFee[];
  invoices: AgencyInvoice[];
  aliases: Map<string, string>;
  dataAsOf: Date | null;
}

const AGENCY_TYPES = new Set<string>(AGENCY_SOURCE_TYPES as readonly string[]);

export async function getAgencyInputs(organizationId: string): Promise<AgencyInputs> {
  const staged = await db.stagedRecord.findMany({
    where: {
      organizationId,
      status: "ok",
      run: { status: "COMPLETED", sourceType: { in: [...AGENCY_TYPES] } },
    },
    include: { run: { select: { id: true, sourceType: true, file: { select: { filename: true } } } } },
    take: 200_000,
  });

  const aliases = await getAliases(organizationId, seedAgencyAliases());

  const records: AgencyInput[] = [];
  const assets: AgencyAsset[] = [];
  const fees: AgencyFee[] = [];
  const invoices: AgencyInvoice[] = [];
  for (const s of staged) {
    const d = s.data as Record<string, string>;
    const runId = s.run.id;
    const fileName = s.run.file.filename;
    const rowNumber = s.rowNumber;
    if (s.run.sourceType === "invoice") {
      invoices.push({ project: d.project ?? "", amount: d.amount ?? "", runId, fileName, rowNumber });
    } else if (s.run.sourceType === "asset") {
      assets.push({ project: d.project ?? "", date: d.date ?? "", amount: d.amount ?? "", runId, fileName, rowNumber });
    } else if (s.run.sourceType === "rate") {
      fees.push({ project: d.project ?? "", fee: d.rate ?? "", runId, fileName, rowNumber });
    } else {
      records.push({
        recordKey: s.loadKey ?? d.recordKey ?? `${runId}:${rowNumber}`,
        date: d.date ?? "",
        project: d.project ?? "",
        client: d.client ?? "",
        person: d.person ?? "",
        task: d.task ?? "",
        hours: d.hours ?? "",
        rate: d.rate ?? "",
        revenue: d.revenue ?? "",
        runId,
        fileName,
        rowNumber,
      });
    }
  }

  const latest = await db.stagedRecord.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  return { records, assets, fees, invoices, aliases, dataAsOf: latest?.createdAt ?? null };
}

export async function getAgencyCorrections(organizationId: string): Promise<AppliedCorrection[]> {
  const [corrections, rules] = await Promise.all([
    db.correction.findMany({ where: { organizationId, status: "applied" } }),
    db.standingRule.findMany({ where: { organizationId, active: true } }),
  ]);
  const out = corrections.map(correctionFromRow);
  if (rules.length === 0) return out;

  const staged = await db.stagedRecord.findMany({
    where: {
      organizationId,
      status: "ok",
      run: { status: "COMPLETED", sourceType: { in: [...AGENCY_TYPES] } },
    },
    select: { loadKey: true, data: true },
    take: 200_000,
  });
  const matchable: MatchableRecord[] = staged.map((s) => {
    const d = s.data as Record<string, string>;
    return {
      loadKey: s.loadKey ?? d.recordKey ?? "",
      project: d.project ?? "",
      client: d.client ?? "",
      date: d.date ?? "",
      person: d.person ?? "",
      round: d.round ?? "",
      hours: d.hours ?? "",
      amount: d.amount ?? "",
    };
  });
  for (const r of rules) {
    out.push(
      ...expandRule(
        { id: r.id, kind: r.kind, costKind: r.costKind, matchField: r.matchField, matchValue: r.matchValue, toLoad: r.toLoad, reason: r.reason },
        matchable,
        AGENCY_FIELD_KINDS,
      ),
    );
  }
  return out;
}

export function buildAgencyAnswer(
  inputs: AgencyInputs,
  corrections: AppliedCorrection[],
  weekStart: string,
  weekEnd: string,
): AgencyAnswer {
  const result = computeProjectMargins(
    inputs.records,
    inputs.assets,
    inputs.fees,
    inputs.invoices,
    inputs.aliases,
    corrections,
    weekStart,
    weekEnd,
  );
  const join = joinAgencyByProject(
    inputs.records.map((r) => ({
      sourceType: "time",
      project: r.project,
      date: r.date,
      person: r.person,
      task: r.task,
      hours: r.hours,
      amount: "",
      runId: r.runId,
      rowNumber: r.rowNumber,
    })),
    inputs.aliases,
  );
  return {
    ...result,
    joinConflicts: join.hourConflicts,
    meta: {
      weekStart,
      weekEnd,
      currency: AGENCY_CURRENCY,
      distanceUnit: "hours",
      engineVersion: AGENCY_ENGINE_VERSION,
      dataAsOf: inputs.dataAsOf,
    },
  };
}

export async function getAgencyAnswer(
  organizationId: string,
  weekStartsOn: number,
  anchorISO: string,
): Promise<AgencyAnswer> {
  const { start, end } = weekBounds(anchorISO, weekStartsOn);
  const [inputs, corrections] = await Promise.all([
    getAgencyInputs(organizationId),
    getAgencyCorrections(organizationId),
  ]);
  const asOf = inputs.dataAsOf?.toISOString() ?? "none";
  const cacheKey = `answer:agency:${organizationId}:${start}:${asOf}`;
  const cached = cacheGet<AgencyAnswer>(cacheKey);
  if (cached) return cached;
  const full = buildAgencyAnswer(inputs, corrections, start, end);
  if (full.projects.length <= 5000) cacheSet(cacheKey, full, 60_000);
  return full;
}
