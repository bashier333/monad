import { z } from "zod";
import { db } from "@/lib/core/db";

// ---------------------------------------------------------------------------
// Connector framework: one typed contract for every Foundry data source.
// Every pull flows through runConnectorPull, so retry, cursor, ledger,
// validation, PII scrub, dedupe, backfill, resume and notifications hold
// uniformly across all 15 connectors (Phase A, F2-00001..F2-00450).
// ---------------------------------------------------------------------------

export const CONNECTOR_KEYS = [
  "csv-upload",
  "xlsx-upload",
  "rest-paginated",
  "rest-webhook",
  "postgres-cdc",
  "sqlite-file",
  "opencorporates",
  "courtlistener",
  "edgar",
  "gdelt",
  "tms-export",
  "fuel-cards",
  "broker-email",
  "eld-pings",
  "manual-form",
] as const;

export type ConnectorKey = (typeof CONNECTOR_KEYS)[number];

export type ConnectorKind = "file" | "rest" | "livedata" | "manual";

export function isConnectorKey(v: string): v is ConnectorKey {
  return (CONNECTOR_KEYS as readonly string[]).includes(v);
}

// ---------- config (F2-00001 family: zod config, field errors) ----------

export const connectorConfigSchema = z.object({
  key: z.enum(CONNECTOR_KEYS, { errorMap: () => ({ message: "unknown connector key" }) }),
  organizationId: z.string().min(1, "organizationId is required").max(64),
  cursor: z.string().max(4000).optional(),
  dateFrom: z.string().max(32).optional(),
  dateTo: z.string().max(32).optional(),
  dryRun: z.boolean().optional(),
  fullRefresh: z.boolean().optional(),
  triggeredById: z.string().max(160).optional(),
  /** Inline payload for file/manual/bridge connectors (CSV, JSON lines, or base64 xlsx). */
  sourceText: z.string().max(55_000_000).optional(),
  sourceEncoding: z.enum(["utf8", "base64"]).optional(),
  /** Override endpoint for rest/bridge connectors (tests + self-hosted bridges). */
  endpoint: z.string().url("endpoint must be a valid URL").max(500).optional(),
});

export type ConnectorConfig = z.infer<typeof connectorConfigSchema>;

export function parseConnectorConfig(input: unknown): {
  ok: boolean;
  config?: ConnectorConfig;
  issues?: Array<{ field: string; message: string }>;
} {
  const parsed = connectorConfigSchema.safeParse(input);
  if (parsed.success) return { ok: true, config: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.map((i) => ({
      field: i.path.join(".") || "*",
      message: i.message,
    })),
  };
}

// ---------- rows & definitions ----------

export interface ConnectorRow {
  key: string;
  date?: string;
  fields: Record<string, string>;
}

export interface ConnectorPage {
  rows: ConnectorRow[];
  nextCursor: string | null;
  degraded?: string;
}

export interface PullContext {
  config: ConnectorConfig;
  cursor: string | null;
  fetchImpl: FetchImpl;
  signal?: AbortSignal;
}

export interface ConnectorDefinition {
  key: ConnectorKey;
  label: string;
  kind: ConnectorKind;
  /** Env keys that must be present (server-side only). Empty = none needed. */
  requiresKeys: string[];
  /** Requests-per-minute budget; 429s pause the schedule. */
  defaultRpm: number;
  /** True when a clean pull enumerates the full set (enables tombstones). */
  fullSet: boolean;
  freshnessSlaMs: number;
  pull: (ctx: PullContext) => Promise<ConnectorPage>;
}

const definitions = new Map<ConnectorKey, ConnectorDefinition>();

export function registerConnector(def: ConnectorDefinition): void {
  definitions.set(def.key, def);
}

export function getConnector(key: string): ConnectorDefinition | null {
  return isConnectorKey(key) ? (definitions.get(key) ?? null) : null;
}

export function listConnectors(): ConnectorDefinition[] {
  return CONNECTOR_KEYS.map((k) => definitions.get(k)).filter((d): d is ConnectorDefinition => d != null);
}

export function connectorTypeKey(key: ConnectorKey): string {
  return `conn_${key.replace(/-/g, "_")}`;
}

// ---------- fetch with retry (F2-00004 family) ----------

export interface FetchResponseLike {
  status: number;
  text: () => Promise<string>;
}

export type FetchImpl = (url: string, init?: { signal?: AbortSignal }) => Promise<FetchResponseLike>;

export interface FetchResult {
  ok: boolean;
  status: number;
  json?: unknown;
  error?: string;
  degraded?: boolean;
}

const RETRYABLE = (s: number) => s === 408 || s === 425 || s === 429 || (s >= 500 && s <= 599);

export async function fetchWithRetry(
  url: string,
  opts: { fetchImpl?: FetchImpl; timeoutMs?: number; retries?: number } = {},
): Promise<FetchResult> {
  const fetchImpl = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchImpl);
  const timeoutMs = opts.timeoutMs ?? 8000;
  const retries = opts.retries ?? 2;
  let lastStatus = 0;
  let lastError = "unknown fetch failure";
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 100 * 2 ** (attempt - 1)));
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
      lastStatus = res.status;
      if (res.status >= 200 && res.status < 300) {
        const text = await res.text();
        try {
          return { ok: true, status: res.status, json: text ? JSON.parse(text) : null };
        } catch {
          return { ok: true, status: res.status, json: text };
        }
      }
      lastError = `HTTP ${res.status}`;
      if (!RETRYABLE(res.status)) return { ok: false, status: res.status, error: lastError };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  return { ok: false, status: lastStatus, error: lastError, degraded: true };
}

// ---------- row validation (F2-00023 family) ----------

export interface ConnectorRowIssue {
  rowNumber: number;
  key: string;
  field: string;
  code: string;
  message: string;
}

const NUMERIC_HINTS = ["miles", "revenue", "amount", "gallons", "fee", "qty", "quantity", "detention", "rate"];

export function validateConnectorRow(row: ConnectorRow, rowNumber: number): ConnectorRowIssue[] {
  const issues: ConnectorRowIssue[] = [];
  const fail = (field: string, code: string, message: string) =>
    issues.push({ rowNumber, key: row.key, field, code, message });
  if (!row.key) fail("*", "MISSING_KEY", "row has no dedupe key");
  if (row.date !== undefined && row.date !== "" && Number.isNaN(Date.parse(row.date))) {
    fail("date", "INVALID_DATE", `unparseable date: ${row.date}`);
  }
  for (const [field, value] of Object.entries(row.fields)) {
    const lower = field.toLowerCase();
    if (!NUMERIC_HINTS.some((h) => lower.includes(h))) continue;
    if (value === "" || value == null) continue;
    const n = Number(String(value).replace(/[$,]/g, ""));
    if (Number.isNaN(n)) fail(field, "INVALID_NUMBER", `${field} is not a number: ${value}`);
    else if (n < 0) fail(field, "NEGATIVE_VALUE", `${field} is negative: ${value}`);
  }
  for (const v of Object.values(row.fields)) {
    if (typeof v === "string" && v.includes("�")) {
      fail("*", "ENCODING", "replacement character found — source encoding suspect");
      break;
    }
  }
  return issues;
}

// ---------- PII scrub (F2-00013 family) ----------

const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;
const CARD_RE = /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g;

export function scrubPIIValue(value: string): { value: string; redacted: boolean } {
  let out = value;
  let redacted = false;
  if (SSN_RE.test(out)) {
    out = out.replace(SSN_RE, "[REDACTED-SSN]");
    redacted = true;
  }
  SSN_RE.lastIndex = 0;
  if (CARD_RE.test(out)) {
    out = out.replace(CARD_RE, "[REDACTED-CARD]");
    redacted = true;
  }
  CARD_RE.lastIndex = 0;
  return { value: out, redacted };
}

export function scrubPIIRow(row: ConnectorRow): { row: ConnectorRow; redactedFields: string[] } {
  const redactedFields: string[] = [];
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(row.fields)) {
    const r = scrubPIIValue(v);
    fields[k] = r.value;
    if (r.redacted) redactedFields.push(k);
  }
  return { row: { ...row, fields }, redactedFields };
}

// ---------- store (ledger + cursor + objects) ----------

export interface SyncRunRecord {
  id: string;
  organizationId: string;
  connectorKey: string;
  status: string;
  progress: number;
  rowsPulled: number;
  rowsUpserted: number;
  rowsQuarantined: number;
  cursor: string | null;
  degraded: boolean;
  degradedSources: string[] | null;
  failureReason: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  triggeredById: string;
}

export interface ConnectorStore {
  getCursor(orgId: string, key: ConnectorKey): Promise<string | null>;
  saveCursor(orgId: string, key: ConnectorKey, cursor: string | null): Promise<void>;
  getMapping(orgId: string, key: ConnectorKey): Promise<Record<string, number> | null>;
  saveMapping(orgId: string, key: ConnectorKey, mapping: Record<string, number>): Promise<void>;
  writeSyncRun(rec: Omit<SyncRunRecord, "id" | "startedAt" | "finishedAt"> & { id?: string }): Promise<SyncRunRecord>;
  listSyncRuns(orgId: string, take: number): Promise<SyncRunRecord[]>;
  lastPulledAt(orgId: string, key: ConnectorKey): Promise<Date | null>;
  upsertObjects(orgId: string, typeKey: string, rows: Array<{ key: string; data: Record<string, string> }>): Promise<number>;
  getLiveKeys(orgId: string, typeKey: string): Promise<string[]>;
  tombstoneMissing(orgId: string, typeKey: string, liveKeys: Set<string>): Promise<number>;
  getNextRunAt(orgId: string, key: ConnectorKey): Promise<number | null>;
  pauseSchedule(orgId: string, key: ConnectorKey, untilMs: number): Promise<void>;
}

export function memoryConnectorStore(): ConnectorStore & {
  runs: SyncRunRecord[];
  objects: Map<string, { data: Record<string, string>; deletedAt: Date | null }>;
  cursors: Map<string, string>;
  mappings: Map<string, Record<string, number>>;
} {
  const runs: SyncRunRecord[] = [];
  const objects = new Map<string, { data: Record<string, string>; deletedAt: Date | null }>();
  const cursors = new Map<string, string>();
  const mappings = new Map<string, Record<string, number>>();
  const pauses = new Map<string, number>();
  let seq = 0;
  return {
    runs,
    objects,
    cursors,
    mappings,
    getCursor: async (orgId, key) => cursors.get(`${orgId}:${key}`) ?? null,
    saveCursor: async (orgId, key, cursor) => {
      if (cursor == null) cursors.delete(`${orgId}:${key}`);
      else cursors.set(`${orgId}:${key}`, cursor);
    },
    getMapping: async (orgId, key) => mappings.get(`${orgId}:${key}`) ?? null,
    saveMapping: async (orgId, key, mapping) => {
      mappings.set(`${orgId}:${key}`, mapping);
    },
    writeSyncRun: async (rec) => {
      const full: SyncRunRecord = {
        ...rec,
        id: rec.id ?? `mem-${++seq}`,
        startedAt: new Date(),
        finishedAt: new Date(),
      };
      runs.push(full);
      return full;
    },
    listSyncRuns: async (orgId, take) =>
      runs.filter((r) => r.organizationId === orgId).slice(-take).reverse(),
    lastPulledAt: async (orgId, key) => {
      const mine = runs.filter((r) => r.organizationId === orgId && r.connectorKey === key);
      return mine.length > 0 ? mine[mine.length - 1].finishedAt : null;
    },
    upsertObjects: async (orgId, typeKey, rows) => {
      for (const r of rows) {
        const k = `${orgId}:${typeKey}:${r.key}`;
        const prev = objects.get(k);
        objects.set(k, { data: { ...(prev?.data ?? {}), ...r.data }, deletedAt: null });
      }
      return rows.length;
    },
    getLiveKeys: async (orgId, typeKey) =>
      [...objects.entries()]
        .filter(([k, v]) => k.startsWith(`${orgId}:${typeKey}:`) && v.deletedAt == null)
        .map(([k]) => k.slice(`${orgId}:${typeKey}:`.length)),
    tombstoneMissing: async (orgId, typeKey, liveKeys) => {
      let n = 0;
      for (const [k, v] of objects) {
        if (!k.startsWith(`${orgId}:${typeKey}:`) || v.deletedAt != null) continue;
        if (!liveKeys.has(k.slice(`${orgId}:${typeKey}:`.length))) {
          v.deletedAt = new Date();
          n++;
        }
      }
      return n;
    },
    getNextRunAt: async (orgId, key) => pauses.get(`${orgId}:${key}`) ?? null,
    pauseSchedule: async (orgId, key, untilMs) => {
      pauses.set(`${orgId}:${key}`, untilMs);
    },
  };
}

export const prismaConnectorStore: ConnectorStore = {
  getCursor: async (orgId, key) => {
    const s = await db.connectorState.findUnique({
      where: { organizationId_connectorKey: { organizationId: orgId, connectorKey: key } },
    });
    return s?.cursor ?? null;
  },
  saveCursor: async (orgId, key, cursor) => {
    await db.connectorState.upsert({
      where: { organizationId_connectorKey: { organizationId: orgId, connectorKey: key } },
      update: { cursor, lastPulledAt: new Date() },
      create: { organizationId: orgId, connectorKey: key, cursor, lastPulledAt: new Date() },
    });
  },
  getMapping: async (orgId, key) => {
    const s = await db.connectorState.findUnique({
      where: { organizationId_connectorKey: { organizationId: orgId, connectorKey: key } },
    });
    return (s?.mapping as Record<string, number> | null) ?? null;
  },
  saveMapping: async (orgId, key, mapping) => {
    await db.connectorState.upsert({
      where: { organizationId_connectorKey: { organizationId: orgId, connectorKey: key } },
      update: { mapping: mapping as never },
      create: { organizationId: orgId, connectorKey: key, mapping: mapping as never },
    });
  },
  writeSyncRun: async (rec) => {
    const created = await db.syncRun.create({
      data: {
        organizationId: rec.organizationId,
        connectorKey: rec.connectorKey,
        status: rec.status,
        progress: rec.progress,
        rowsPulled: rec.rowsPulled,
        rowsUpserted: rec.rowsUpserted,
        rowsQuarantined: rec.rowsQuarantined,
        cursor: rec.cursor,
        degraded: rec.degraded,
        degradedSources: (rec.degradedSources ?? undefined) as never,
        failureReason: rec.failureReason,
        finishedAt: new Date(),
        triggeredById: rec.triggeredById,
      },
    });
    return {
      id: created.id,
      organizationId: created.organizationId,
      connectorKey: created.connectorKey,
      status: created.status,
      progress: created.progress,
      rowsPulled: created.rowsPulled,
      rowsUpserted: created.rowsUpserted,
      rowsQuarantined: created.rowsQuarantined,
      cursor: created.cursor,
      degraded: created.degraded,
      degradedSources: (created.degradedSources as string[] | null) ?? null,
      failureReason: created.failureReason,
      startedAt: created.startedAt,
      finishedAt: created.finishedAt,
      triggeredById: created.triggeredById,
    };
  },
  listSyncRuns: async (orgId, take) => {
    const rows = await db.syncRun.findMany({
      where: { organizationId: orgId },
      orderBy: { startedAt: "desc" },
      take: Math.min(Math.max(take, 1), 100),
    });
    return rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      connectorKey: r.connectorKey,
      status: r.status,
      progress: r.progress,
      rowsPulled: r.rowsPulled,
      rowsUpserted: r.rowsUpserted,
      rowsQuarantined: r.rowsQuarantined,
      cursor: r.cursor,
      degraded: r.degraded,
      degradedSources: (r.degradedSources as string[] | null) ?? null,
      failureReason: r.failureReason,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      triggeredById: r.triggeredById,
    }));
  },
  lastPulledAt: async (orgId, key) => {
    const s = await db.connectorState.findUnique({
      where: { organizationId_connectorKey: { organizationId: orgId, connectorKey: key } },
    });
    return s?.lastPulledAt ?? null;
  },
  upsertObjects: async (orgId, typeKey, rows) => {
    let n = 0;
    for (const r of rows) {
      const prev = await db.ontoObject.findUnique({
        where: { organizationId_typeKey_key: { organizationId: orgId, typeKey, key: r.key } },
      });
      const merged = { ...((prev?.data as Record<string, string> | null) ?? {}), ...r.data };
      await db.ontoObject.upsert({
        where: { organizationId_typeKey_key: { organizationId: orgId, typeKey, key: r.key } },
        update: { data: merged as never, version: { increment: 1 }, deletedAt: null },
        create: { organizationId: orgId, typeKey, key: r.key, data: merged as never },
      });
      n++;
    }
    return n;
  },
  getLiveKeys: async (orgId, typeKey) => {
    const rows = await db.ontoObject.findMany({
      where: { organizationId: orgId, typeKey, deletedAt: null },
      select: { key: true },
      take: 50_000,
    });
    return rows.map((r) => r.key);
  },
  tombstoneMissing: async (orgId, typeKey, liveKeys) => {
    const stale = await db.ontoObject.findMany({
      where: { organizationId: orgId, typeKey, deletedAt: null },
      select: { key: true },
      take: 50_000,
    });
    const dead = stale.map((r) => r.key).filter((k) => !liveKeys.has(k));
    if (dead.length === 0) return 0;
    await db.ontoObject.updateMany({
      where: { organizationId: orgId, typeKey, key: { in: dead } },
      data: { deletedAt: new Date() },
    });
    return dead.length;
  },
  getNextRunAt: async (orgId, key) => {
    const s = await db.connectorState.findUnique({
      where: { organizationId_connectorKey: { organizationId: orgId, connectorKey: key } },
    });
    return s?.nextRunAt ? s.nextRunAt.getTime() : null;
  },
  pauseSchedule: async (orgId, key, untilMs) => {
    await db.connectorState.upsert({
      where: { organizationId_connectorKey: { organizationId: orgId, connectorKey: key } },
      update: { nextRunAt: new Date(untilMs) },
      create: { organizationId: orgId, connectorKey: key, nextRunAt: new Date(untilMs) },
    });
  },
};

// ---------- runner ----------

export interface PullSummary {
  status: "COMPLETED" | "DEGRADED" | "FAILED" | "SKIPPED";
  rowsPulled: number;
  rowsUpserted: number;
  rowsQuarantined: number;
  tombstoned: number;
  cursor: string | null;
  degraded: boolean;
  degradedSources: string[];
  rowErrors: ConnectorRowIssue[];
  failureReason: string | null;
}

export interface PullDeps {
  store: ConnectorStore;
  fetchImpl?: FetchImpl;
  notify?: (summary: PullSummary, def: ConnectorDefinition, orgId: string) => Promise<void>;
  now?: () => number;
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
  maxPages?: number;
}

const ROW_ERROR_CAP = 500;

export async function runConnectorPull(
  def: ConnectorDefinition,
  rawConfig: unknown,
  deps: PullDeps,
): Promise<PullSummary> {
  const parsed = parseConnectorConfig(rawConfig);
  if (!parsed.ok || !parsed.config) {
    const summary: PullSummary = {
      status: "FAILED",
      rowsPulled: 0,
      rowsUpserted: 0,
      rowsQuarantined: 0,
      tombstoned: 0,
      cursor: null,
      degraded: false,
      degradedSources: [],
      rowErrors: [],
      failureReason: `invalid config: ${(parsed.issues ?? []).map((i) => `${i.field}: ${i.message}`).join("; ")}`,
    };
    if (deps.notify) {
      const orgId = (rawConfig as { organizationId?: string } | null)?.organizationId ?? "";
      await deps.notify(summary, def, typeof orgId === "string" ? orgId : "");
    }
    return summary;
  }
  const config = parsed.config;
  if (config.key !== def.key) {
    const summary: PullSummary = {
      status: "FAILED",
      rowsPulled: 0,
      rowsUpserted: 0,
      rowsQuarantined: 0,
      tombstoned: 0,
      cursor: null,
      degraded: false,
      degradedSources: [],
      rowErrors: [],
      failureReason: `config key ${config.key} does not match connector ${def.key}`,
    };
    if (deps.notify) await deps.notify(summary, def, config.organizationId);
    return summary;
  }
  const store = deps.store;
  const now = deps.now ?? Date.now;
  const fetchImpl = deps.fetchImpl ?? (globalThis.fetch as unknown as FetchImpl);
  const maxPages = deps.maxPages ?? 10_000;

  const fail = async (reason: string, cursor: string | null): Promise<PullSummary> => {
    const summary: PullSummary = {
      status: "FAILED",
      rowsPulled: 0,
      rowsUpserted: 0,
      rowsQuarantined: 0,
      tombstoned: 0,
      cursor,
      degraded: false,
      degradedSources: [],
      rowErrors: [],
      failureReason: reason,
    };
    await store.writeSyncRun({
      organizationId: config.organizationId,
      connectorKey: def.key,
      status: "FAILED",
      progress: 100,
      rowsPulled: 0,
      rowsUpserted: 0,
      rowsQuarantined: 0,
      cursor,
      degraded: false,
      degradedSources: [],
      failureReason: reason,
      triggeredById: config.triggeredById ?? "",
    });
    if (deps.notify) await deps.notify(summary, def, config.organizationId);
    return summary;
  };

  const secretCheck = checkConnectorSecrets(def, process.env as Record<string, string | undefined>);
  if (!secretCheck.ok) {
    return fail(`missing server secrets for ${def.key}: ${secretCheck.missing.join(", ")} (set them in the host secret store; never in code)`, null);
  }

  // Rate budget: a 429 pause freezes the schedule instead of burning quota.
  const pausedUntil = await store.getNextRunAt(config.organizationId, def.key);
  if (pausedUntil != null && pausedUntil > now()) {
    const summary: PullSummary = {
      status: "SKIPPED",
      rowsPulled: 0,
      rowsUpserted: 0,
      rowsQuarantined: 0,
      tombstoned: 0,
      cursor: config.cursor ?? (await store.getCursor(config.organizationId, def.key)),
      degraded: false,
      degradedSources: [],
      rowErrors: [],
      failureReason: `rate budget exhausted; schedule paused until ${new Date(pausedUntil).toISOString()}`,
    };
    await store.writeSyncRun({
      organizationId: config.organizationId,
      connectorKey: def.key,
      status: "SKIPPED",
      progress: 100,
      rowsPulled: 0,
      rowsUpserted: 0,
      rowsQuarantined: 0,
      cursor: summary.cursor,
      degraded: false,
      degradedSources: [],
      failureReason: summary.failureReason,
      triggeredById: config.triggeredById ?? "",
    });
    return summary;
  }

  let cursor = config.cursor ?? (await store.getCursor(config.organizationId, def.key));
  const typeKey = connectorTypeKey(def.key);
  const seen = new Map<string, Record<string, string>>();
  const rowErrors: ConnectorRowIssue[] = [];
  const degradedSources: string[] = [];
  let rowsPulled = 0;
  let upserted = 0;
  let pages = 0;

  try {
    for (;;) {
      if (deps.signal?.aborted) throw new Error("pull aborted by operator");
      if (pages >= maxPages) break;
      const page = await def.pull({ config, cursor, fetchImpl, signal: deps.signal });
      pages++;
      rowsPulled += page.rows.length;
      let rowNumber = rowsPulled - page.rows.length;
      const pageValid: Array<{ key: string; data: Record<string, string> }> = [];
      for (const raw of page.rows) {
        rowNumber++;
        const { row } = scrubPIIRow(raw);
        const issues = validateConnectorRow(row, rowNumber);
        if (issues.length === 0) {
          const prev = seen.get(row.key);
          const merged = { ...(prev ?? {}), ...row.fields };
          seen.set(row.key, merged);
          pageValid.push({ key: row.key, data: merged });
        } else {
          if (rowErrors.length < ROW_ERROR_CAP) rowErrors.push(...issues.slice(0, ROW_ERROR_CAP - rowErrors.length));
        }
      }
      // Persist each page before advancing the cursor: a kill loses at most
      // the in-flight page, and resume never re-fetches completed work.
      upserted += await store.upsertObjects(config.organizationId, typeKey, pageValid);
      if (page.degraded) degradedSources.push(page.degraded);
      cursor = page.nextCursor;
      await store.saveCursor(config.organizationId, def.key, cursor);
      deps.onProgress?.(Math.min(90, Math.round((pages / Math.max(pages + 1, 4)) * 90)));
      if (page.nextCursor == null) break;
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e), cursor);
  }

  const quarantined = rowsPulled - seen.size;

  // Delete handling: full-set clean pulls tombstone keys the source no longer lists.
  let tombstoned = 0;
  const fullSetPull = (def.fullSet || config.fullRefresh === true) && degradedSources.length === 0;
  if (fullSetPull) {
    tombstoned = await store.tombstoneMissing(config.organizationId, typeKey, new Set(seen.keys()));
  }

  const degraded = degradedSources.length > 0;
  if (degradedSources.some((d) => d.startsWith("rate-limited"))) {
    await store.pauseSchedule(config.organizationId, def.key, now() + 60_000);
  }
  const summary: PullSummary = {
    status: degraded ? "DEGRADED" : "COMPLETED",
    rowsPulled,
    rowsUpserted: upserted,
    rowsQuarantined: quarantined,
    tombstoned,
    cursor,
    degraded,
    degradedSources,
    rowErrors,
    failureReason: null,
  };
  await store.writeSyncRun({
    organizationId: config.organizationId,
    connectorKey: def.key,
    status: summary.status,
    progress: 100,
    rowsPulled,
    rowsUpserted: upserted,
    rowsQuarantined: quarantined,
    cursor,
    degraded,
    degradedSources,
    failureReason: null,
    triggeredById: config.triggeredById ?? "",
  });
  void now;
  if (deps.notify) await deps.notify(summary, def, config.organizationId);
  return summary;
}

// ---------- dry-run preview: first page only, zero store writes ----------

export async function previewConnectorPull(
  def: ConnectorDefinition,
  rawConfig: unknown,
  deps: Pick<PullDeps, "fetchImpl" | "signal"> = {},
): Promise<{ rows: ConnectorRow[]; mapping: Record<string, number>; issues: ConnectorRowIssue[] }> {
  const parsed = parseConnectorConfig(rawConfig);
  if (!parsed.ok || !parsed.config) throw new Error("invalid config for preview");
  const fetchImpl = deps.fetchImpl ?? (globalThis.fetch as unknown as FetchImpl);
  const page = await def.pull({ config: parsed.config, cursor: null, fetchImpl, signal: deps.signal });
  const rows = page.rows.slice(0, 20).map((r) => scrubPIIRow(r).row);
  const issues = rows.flatMap((r, i) => validateConnectorRow(r, i + 1));
  const mapping: Record<string, number> = {};
  if (rows.length > 0) Object.keys(rows[0].fields).forEach((k, i) => (mapping[k] = i));
  return { rows, mapping, issues };
}

// ---------- export back ----------

export function rowsToCsv(rows: Array<{ key: string; date?: string; fields: Record<string, string> }>): string {
  const cols = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r.fields)) cols.add(k);
  const header = ["key", "date", ...[...cols].sort()];
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([r.key, r.date ?? "", ...[...cols].sort().map((c) => esc(r.fields[c] ?? ""))].join(","));
  }
  return lines.join("\n");
}

// ---------- freshness (F2-00010 family) ----------

export function connectorFreshness(
  lastPulledAt: Date | null,
  nowMs: number,
  slaMs: number,
): { state: "fresh" | "stale" | "never"; ageMs: number | null } {
  if (!lastPulledAt) return { state: "never", ageMs: null };
  const ageMs = nowMs - lastPulledAt.getTime();
  return { state: ageMs > slaMs ? "stale" : "fresh", ageMs };
}

export function freshnessBadge(
  lastPulledAt: Date | null,
  nowMs: number,
  slaMs: number,
): string {
  const f = connectorFreshness(lastPulledAt, nowMs, slaMs);
  if (f.state === "never") return "NEVER SYNCED";
  if (f.state === "stale") return `STALE — last sync ${Math.round((f.ageMs ?? 0) / 3600000)}h ago`;
  return "FRESH";
}

// ---------- kill check (F2-00030 family) ----------

export function flagUnusedConnectors(
  keys: ConnectorKey[],
  lastPullByKey: Partial<Record<ConnectorKey, Date | null>>,
  nowMs: number,
  idleMs = 30 * 24 * 3600 * 1000,
): Array<{ key: ConnectorKey; idleDays: number | null; flagged: boolean }> {
  return keys.map((key) => {
    const last = lastPullByKey[key] ?? null;
    if (!last) return { key, idleDays: null, flagged: true };
    const idleDays = Math.floor((nowMs - last.getTime()) / (24 * 3600 * 1000));
    return { key, idleDays, flagged: nowMs - last.getTime() > idleMs };
  });
}

// ---------- secrets (F2-00016 family) ----------

export function checkConnectorSecrets(
  def: ConnectorDefinition,
  env: Record<string, string | undefined>,
): { ok: boolean; missing: string[] } {
  const missing = def.requiresKeys.filter((k) => !env[k]);
  return { ok: missing.length === 0, missing };
}

export function requireConnectorSecrets(
  def: ConnectorDefinition,
  env: Record<string, string | undefined>,
): void {
  const check = checkConnectorSecrets(def, env);
  if (!check.ok) {
    throw new Error(
      `connector ${def.key} needs server secrets: ${check.missing.join(", ")} — set them in the host secret store, never in code`,
    );
  }
}

// ---------- rate budget (F2-00017 family) ----------

export function rpmWindowMs(rpm: number): number {
  return Math.floor(60_000 / Math.max(rpm, 1));
}
