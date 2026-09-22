import { parseBuffer } from "@/lib/core/ingest/parse";
import { scanBuffer } from "@/lib/core/ingest/scan";
import {
  fetchWithRetry,
  registerConnector,
  type ConnectorDefinition,
  type ConnectorKey,
  type ConnectorRow,
  type PullContext,
} from "@/lib/core/ingest/connector";
import { checkOpenCorporates } from "@/lib/core/livedata/opencorporates";
import { checkCourtListener } from "@/lib/core/livedata/courtlistener";
import { checkEdgar } from "@/lib/core/livedata/edgar";
import { checkGdelt } from "@/lib/core/livedata/gdelt";
import type { ClientOpts, SourceResult } from "@/lib/core/livedata/types";

// ---------------------------------------------------------------------------
// The 15 Phase-A connectors. File connectors parse inline payloads (or the
// sample corpus in fixtures/connector-<key>.csv). REST/bridge connectors poll
// operator-configured endpoints with cursor paging. Livedata connectors page
// through an org watchlist (one company per line in sourceText) and map live
// source flags to rows. Nothing here invents data: every row traces to bytes
// the operator supplied or an upstream API response.
// ---------------------------------------------------------------------------

const DAY = 24 * 3600 * 1000;

function payloadBytes(ctx: PullContext): Buffer {
  const enc = ctx.config.sourceEncoding === "base64" ? "base64" : "utf8";
  return Buffer.from(ctx.config.sourceText ?? "", enc as BufferEncoding);
}

function genericRows(headers: string[], rows: string[][]): ConnectorRow[] {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const keys = headers.map(norm);
  const keyIdx = keys.findIndex((k) => ["loadid", "load", "id", "key", "ref", "sku", "invoice"].includes(k));
  const dateIdx = keys.findIndex((k) => ["date", "pickupdate", "txndate", "eta", "at"].includes(k));
  return rows.map((cells, i) => {
    const fields: Record<string, string> = {};
    headers.forEach((h, j) => {
      fields[norm(h) || `col${j}`] = cells[j] ?? "";
    });
    return {
      key: (keyIdx >= 0 ? cells[keyIdx] : "") || `row-${i + 1}`,
      date: dateIdx >= 0 ? cells[dateIdx] : undefined,
      fields,
    };
  });
}

function filePull(filename: string): ConnectorDefinition["pull"] {
  return async (ctx) => {
    const bytes = payloadBytes(ctx);
    const scan = scanBuffer(filename, bytes);
    if (!scan.ok) throw new Error(`scan rejected ${filename}: ${scan.reason}`);
    const { headers, rows } = parseBuffer(filename, bytes);
    if (headers.length === 0) throw new Error(`no headers found in ${filename}`);
    return { rows: genericRows(headers, rows), nextCursor: null };
  };
}

function jsonLinesPull(kind: string): ConnectorDefinition["pull"] {
  return async (ctx) => {
    const text = ctx.config.sourceText ?? "";
    const out: ConnectorRow[] = [];
    const errors: string[] = [];
    text.split("\n").forEach((line, i) => {
      const t = line.trim();
      if (!t) return;
      try {
        const obj = JSON.parse(t) as Record<string, unknown>;
        const str = (v: unknown) => (v == null ? "" : String(v));
        const fields: Record<string, string> = {};
        for (const [k, v] of Object.entries(obj)) {
          if (k === "_key" || k === "_date") continue;
          fields[k] = str(v);
        }
        out.push({ key: str(obj._key) || `${kind}-${i + 1}`, date: str(obj._date) || undefined, fields });
      } catch {
        errors.push(`line ${i + 1} is not valid JSON`);
      }
    });
    if (out.length === 0 && errors.length > 0) throw new Error(errors[0]);
    return { rows: out, nextCursor: null };
  };
}

function restPull(defaultPath: string): ConnectorDefinition["pull"] {
  return async (ctx) => {
    const base = ctx.config.endpoint ?? process.env[`${defaultPath}_URL`] ?? "";
    if (!base) throw new Error(`no endpoint configured (set endpoint or ${defaultPath}_URL)`);
    const url = new URL(base);
    if (ctx.cursor) url.searchParams.set("cursor", ctx.cursor);
    if (ctx.config.dateFrom) url.searchParams.set("from", ctx.config.dateFrom);
    if (ctx.config.dateTo) url.searchParams.set("to", ctx.config.dateTo);
    const res = await fetchWithRetry(url.toString(), { fetchImpl: ctx.fetchImpl });
    if (!res.ok && res.status === 429) {
      return { rows: [], nextCursor: ctx.cursor, degraded: "rate-limited: schedule paused 60s" };
    }
    if (!res.ok) throw new Error(`upstream ${res.status}: ${res.error ?? "fetch failed"}`);
    const body = res.json as { rows?: Array<Record<string, unknown>>; nextCursor?: string | null } | null;
    const rawRows = Array.isArray(body?.rows) ? body.rows : [];
    const rows: ConnectorRow[] = rawRows.map((r, i) => {
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(r)) {
        if (k === "_key" || k === "_date") continue;
        fields[k] = v == null ? "" : String(v);
      }
      const key = r._key != null ? String(r._key) : `rest-${ctx.cursor ?? "0"}-${i + 1}`;
      return { key, date: r._date != null ? String(r._date) : undefined, fields };
    });
    return { rows, nextCursor: body?.nextCursor ?? null };
  };
}

function livedataPull(
  source: string,
  check: (company: string, opts?: ClientOpts) => Promise<SourceResult>,
  tokenEnv: string,
): ConnectorDefinition["pull"] {
  return async (ctx) => {
    const watchlist = (ctx.config.sourceText ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
    if (watchlist.length === 0) throw new Error(`${source}: watchlist is empty (one company per line in sourceText)`);
    const idx = ctx.cursor ? Number.parseInt(ctx.cursor, 10) || 0 : 0;
    const company = watchlist[idx % watchlist.length];
    const token = process.env[tokenEnv] || undefined;
    // Adapt the connector fetch shape ({status,text}) to the DOM Response
    // shape livedata clients expect ({ok,status,json}).
    const shimFetch = async (url: string, init?: { signal?: AbortSignal }) => {
      const r = await ctx.fetchImpl(url, { signal: init?.signal });
      const text = await r.text();
      return {
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        json: async () => (text ? (JSON.parse(text) as unknown) : null),
        text: async () => text,
      };
    };
    const result = await check(company, { fetchImpl: shimFetch as never, token });
    const next = idx + 1;
    const nextCursor = next < watchlist.length ? String(next) : null;
    if (!result.ok && result.flags.length === 0) {
      return { rows: [], nextCursor, degraded: `${source}: ${result.error ?? "upstream failure"}` };
    }
    const rows: ConnectorRow[] = result.flags.map((f, i) => ({
      key: `${source}-${company.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${i + 1}`,
      date: f.at,
      fields: { company, text: f.text, source: f.source, severity: f.severity, url: f.url ?? "" },
    }));
    // Round-robin across pulls: advance while companies remain, terminate
    // (null) after the last one so the runner finishes; the stored cursor
    // then restarts at 0 on the next scheduled pull.
    return { rows, nextCursor };
  };
}

const DEFS: ConnectorDefinition[] = [
  { key: "csv-upload", label: "CSV upload", kind: "file", requiresKeys: [], defaultRpm: 60, fullSet: true, freshnessSlaMs: DAY, pull: filePull("pull.csv") },
  { key: "xlsx-upload", label: "Excel upload", kind: "file", requiresKeys: [], defaultRpm: 60, fullSet: true, freshnessSlaMs: DAY, pull: filePull("pull.xlsx") },
  { key: "rest-paginated", label: "Paginated REST", kind: "rest", requiresKeys: [], defaultRpm: 120, fullSet: false, freshnessSlaMs: DAY, pull: restPull("REST_PAGINATED") },
  { key: "rest-webhook", label: "Webhook inbox", kind: "rest", requiresKeys: [], defaultRpm: 300, fullSet: false, freshnessSlaMs: DAY, pull: restPull("REST_WEBHOOK") },
  { key: "postgres-cdc", label: "Postgres CDC bridge", kind: "rest", requiresKeys: [], defaultRpm: 300, fullSet: false, freshnessSlaMs: DAY, pull: restPull("PG_CDC_BRIDGE") },
  { key: "sqlite-file", label: "SQLite export bridge", kind: "rest", requiresKeys: [], defaultRpm: 120, fullSet: true, freshnessSlaMs: DAY, pull: restPull("SQLITE_BRIDGE") },
  { key: "opencorporates", label: "OpenCorporates registry", kind: "livedata", requiresKeys: [], defaultRpm: 30, fullSet: false, freshnessSlaMs: 7 * DAY, pull: livedataPull("opencorporates", checkOpenCorporates, "OPENCORPORATES_TOKEN") },
  { key: "courtlistener", label: "CourtListener dockets", kind: "livedata", requiresKeys: [], defaultRpm: 30, fullSet: false, freshnessSlaMs: 7 * DAY, pull: livedataPull("courtlistener", checkCourtListener, "COURTLISTENER_TOKEN") },
  { key: "edgar", label: "SEC EDGAR filings", kind: "livedata", requiresKeys: [], defaultRpm: 30, fullSet: false, freshnessSlaMs: 7 * DAY, pull: livedataPull("edgar", checkEdgar, "SEC_CONTACT") },
  { key: "gdelt", label: "GDELT press", kind: "livedata", requiresKeys: [], defaultRpm: 30, fullSet: false, freshnessSlaMs: 7 * DAY, pull: livedataPull("gdelt", checkGdelt, "GDELT_TOKEN") },
  { key: "tms-export", label: "TMS export", kind: "file", requiresKeys: [], defaultRpm: 60, fullSet: true, freshnessSlaMs: DAY, pull: filePull("tms-week.csv") },
  { key: "fuel-cards", label: "Fuel card export", kind: "file", requiresKeys: [], defaultRpm: 60, fullSet: true, freshnessSlaMs: DAY, pull: filePull("fuel-week.csv") },
  { key: "broker-email", label: "Broker email JSON", kind: "file", requiresKeys: [], defaultRpm: 120, fullSet: false, freshnessSlaMs: DAY, pull: jsonLinesPull("broker-email") },
  { key: "eld-pings", label: "ELD pings JSON", kind: "file", requiresKeys: [], defaultRpm: 300, fullSet: false, freshnessSlaMs: DAY, pull: jsonLinesPull("eld-pings") },
  { key: "manual-form", label: "Manual form entries", kind: "manual", requiresKeys: [], defaultRpm: 600, fullSet: false, freshnessSlaMs: 30 * DAY, pull: jsonLinesPull("manual-form") },
];

for (const d of DEFS) registerConnector(d);

export const CONNECTOR_LABELS: Record<ConnectorKey, string> = Object.fromEntries(
  DEFS.map((d) => [d.key, d.label]),
) as Record<ConnectorKey, string>;
