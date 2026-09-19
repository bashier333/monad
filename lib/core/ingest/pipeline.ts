import { ImportStatus, Prisma } from "@prisma/client";
import { fingerprint } from "@/lib/core/ingest/columns";
import { getAdapter } from "@/lib/core/ingest/adapters";
import { findDuplicateFile, findOverlappingRuns } from "@/lib/core/ingest/dedupe";
import { findConflicts } from "@/lib/core/ingest/merge";
import { parseBuffer } from "@/lib/core/ingest/parse";
import { scanBuffer } from "@/lib/core/ingest/scan";
import { bustAnswerCache } from "@/lib/core/answers/service";
import { recordEvent } from "@/lib/core/events-db";
import { db } from "@/lib/core/db";
import { logger } from "@/lib/core/logger";
import { readBytes } from "@/lib/core/storage";

const ERROR_ROW_CAP = 500;

async function setProgress(runId: string, progress: number, extra: Record<string, unknown> = {}) {
  await db.importRun.update({ where: { id: runId }, data: { progress, ...extra } });
}

async function fail(runId: string, requestId: string, reason: string) {
  logger.error("import failed", { requestId, runId, reason });
  await db.importRun.update({
    where: { id: runId },
    data: { status: "FAILED", failureReason: reason, progress: 100 },
  });
}

export async function processImport(runId: string, requestId = "bg"): Promise<void> {
  const run = await db.importRun.findUnique({
    where: { id: runId },
    include: { file: true },
  });
  if (!run || run.status !== "PENDING") return;

  await db.importRun.update({ where: { id: runId }, data: { status: "PROCESSING", progress: 5 } });

  try {
    const bytes = await readBytes(run.file.storageKey);
    const scan = scanBuffer(run.file.filename, bytes);
    if (!scan.ok) {
      await fail(runId, requestId, scan.reason ?? "scan failed");
      return;
    }
    await db.dataFile.update({ where: { id: run.fileId }, data: { scannedOk: true, mime: scan.mime } });
    await setProgress(runId, 15);

    const { headers, rows, skipped, sheetName, encoding } = parseBuffer(run.file.filename, bytes);
    if (headers.length === 0) {
      await fail(runId, requestId, "no headers found");
      return;
    }
    logger.info("import parsed", {
      requestId,
      runId,
      encoding,
      sheet: sheetName ?? null,
      skipped: skipped.length,
    });
    await setProgress(runId, 30, { headers, totalRows: rows.length });

    const adapter = getAdapter(run.sourceType);
    if (!adapter) {
      await fail(runId, requestId, `unsupported sourceType: ${run.sourceType}`);
      return;
    }
    const suggestion = adapter.detect(headers);
    const drift = detectHeaderDrift(run.headers as string[] | null, headers);
    if (drift.added.length > 0 || drift.removed.length > 0) {
      logger.warn("header drift vs previous run", { requestId, runId, drift });
    }
    await setProgress(runId, 45, {
      mapping: suggestion.mapping,
      mappingConfidence: suggestion.confidence,
    });

    const mapped = adapter.apply(headers, rows, suggestion.mapping);
    const seen = new Set<string>();
    let okRows = 0;
    const staged: Array<{ rowNumber: number; loadKey: string | null; data: object; status: string }> = [];
    const errorRows: Array<{ rowNumber: number; raw: object; errors: object }> = [];
    let dateMin: Date | null = null;
    let dateMax: Date | null = null;

    for (const { rowNumber, record } of mapped) {
      const issues = adapter.validate(record, seen, run.sourceType);
      if (issues.length === 0) {
        okRows++;
        const loadKey = adapter.loadKey(record);
        staged.push({ rowNumber, loadKey, data: { ...record }, status: "ok" });
        const t = Date.parse(adapter.dateOf?.(record) ?? record.date ?? "");
        if (!Number.isNaN(t)) {
          const d = new Date(t);
          if (!dateMin || d < dateMin) dateMin = d;
          if (!dateMax || d > dateMax) dateMax = d;
        }
      } else if (errorRows.length < ERROR_ROW_CAP) {
        errorRows.push({ rowNumber, raw: { ...record }, errors: issues });
      }
    }
    const quarantinedRows = mapped.length - okRows;
    await setProgress(runId, 65);

    await db.stagedRecord.createMany({
      data: staged.map((s) => ({
        runId,
        organizationId: run.organizationId,
        rowNumber: s.rowNumber,
        loadKey: s.loadKey,
        data: s.data,
        status: s.status,
      })),
    });
    if (errorRows.length > 0) {
      await db.importRowError.createMany({
        data: errorRows.map((e) => ({ runId, rowNumber: e.rowNumber, raw: e.raw, errors: e.errors })),
      });
    }
    await setProgress(runId, 80, { okRows, quarantinedRows, dateMin, dateMax });

    const dup = await findDuplicateFile(run.organizationId, run.file.checksum, runId);
    let overlap: Awaited<ReturnType<typeof findOverlappingRuns>> = [];
    if (dateMin && dateMax) {
      overlap = await findOverlappingRuns(run.organizationId, dateMin, dateMax, runId);
    }
    if (dup || overlap.length > 0) {
      await db.importRun.update({
        where: { id: runId },
        data: {
          status: "NEEDS_REVIEW",
          progress: 90,
          duplicateOfRunId: dup?.id ?? null,
          decisionNote:
            dup != null
              ? `same file content as run ${dup.id}`
              : `date range overlaps ${overlap.length} completed run(s)`,
        },
      });
      await recordEvent("import.needs_review", run.organizationId, packFromSourceType(run.sourceType), { runId, dup: dup?.id ?? null, overlap: overlap.length });
      logger.info("import needs review", { requestId, runId, dup: dup?.id ?? null, overlap: overlap.length });
      return;
    }

    await finalizeRun(runId, requestId, "auto");
  } catch (e) {
    await fail(runId, requestId, e instanceof Error ? e.message : String(e));
  }
}

export async function finalizeRun(
  runId: string,
  requestId: string,
  decision: string,
): Promise<void> {
  const run = await db.importRun.findUnique({ where: { id: runId } });
  if (!run) return;

  if (decision === "replace" && run.dateMin && run.dateMax) {
    const overlap = await findOverlappingRuns(run.organizationId, run.dateMin, run.dateMax, runId);
    for (const o of overlap) {
      await db.importRun.update({
        where: { id: o.id },
        data: { status: "CANCELLED", decision: "superseded", decisionNote: `superseded by run ${runId}` },
      });
    }
  }

  const prior = await db.stagedRecord.findMany({
    where: {
      organizationId: run.organizationId,
      runId: { not: runId },
      run: { status: "COMPLETED" },
      loadKey: { not: null },
    },
    select: { runId: true, loadKey: true, data: true },
    take: 50_000,
  });

  const current = new Map<string, Record<string, string>>();
  const mine = await db.stagedRecord.findMany({
    where: { runId, status: "ok", loadKey: { not: null } },
    select: { loadKey: true, data: true },
    take: 50_000,
  });
  for (const m of mine) {
    if (m.loadKey) current.set(m.loadKey, m.data as Record<string, string>);
  }
  const conflicts = findConflicts(
    current,
    prior.map((p) => ({ runId: p.runId, loadKey: p.loadKey ?? "", data: p.data as Record<string, string> })),
  );

  const mapping = (run.mapping ?? {}) as Record<string, number>;
  const confidence = (run.mappingConfidence ?? {}) as Record<string, number>;
  const headers = (run.headers ?? []) as string[];
  if (headers.length > 0) {
    await db.columnMapping.upsert({
      where: {
        organizationId_sourceType_fingerprint: {
          organizationId: run.organizationId,
          sourceType: run.sourceType,
          fingerprint: fingerprint(headers),
        },
      },
      update: { mapping, confidence },
      create: {
        organizationId: run.organizationId,
        sourceType: run.sourceType,
        fingerprint: fingerprint(headers),
        mapping,
        confidence,
      },
    });
  }

  await db.importRun.update({
    where: { id: runId },
    data: { status: "COMPLETED", progress: 100, decision, conflicts: conflicts as unknown as Prisma.InputJsonValue },
  });
  await recordEvent("import.completed", run.organizationId, packFromSourceType(run.sourceType), { runId, decision });
  bustAnswerCache(run.organizationId);
  logger.info("import completed", { requestId, runId, decision, conflicts: conflicts.length });
}

const AGENCY_TYPES_SET = new Set(["time", "revision", "approval", "invoice", "asset", "rate", "project", "feedback"]);

export function packFromSourceType(sourceType: string): string {
  return AGENCY_TYPES_SET.has(sourceType) ? "agency" : "freight";
}

export function detectHeaderDrift(prev: string[] | null, cur: string[]): { added: string[]; removed: string[] } {
  if (!prev || prev.length === 0) return { added: [], removed: [] };
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const p = new Set(prev.map(norm));
  const c = new Set(cur.map(norm));
  return {
    added: cur.filter((h) => !p.has(norm(h))),
    removed: prev.filter((h) => !c.has(norm(h))),
  };
}

export async function cancelRun(runId: string, requestId: string, note: string): Promise<void> {
  await db.importRun.update({
    where: { id: runId },
    data: { status: "CANCELLED", progress: 100, decision: "skip", decisionNote: note },
  });
  logger.info("import cancelled", { requestId, runId });
}

export const STALE_MS = 30 * 60 * 1000;

export function isStaleRun(updatedAt: Date, nowMs: number): boolean {
  return nowMs - updatedAt.getTime() > STALE_MS;
}

export async function sweepStaleRuns(requestId: string): Promise<number> {
  const stuck = await db.importRun.findMany({
    where: { status: { in: ["PENDING", "PROCESSING"] } },
    select: { id: true, updatedAt: true },
    take: 100,
  });
  const now = Date.now();
  let reset = 0;
  for (const r of stuck) {
    if (isStaleRun(r.updatedAt, now)) {
      await db.importRun.update({
        where: { id: r.id },
        data: { status: "PENDING", progress: 0, failureReason: "reset by stale-run sweep (worker likely died)" },
      });
      reset++;
    }
  }
  if (reset > 0) logger.warn("stale runs reset to PENDING", { requestId, reset });
  return reset;
}

export type { ImportStatus };
