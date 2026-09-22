import { db } from "@/lib/core/db";
import { normalizeKey } from "@/lib/core/ontology/identity";
import { KEY_RE } from "@/lib/core/ontology/schema";
import { createType, listTypes, updateType } from "@/lib/core/ontology/registry";
import { upsertObject } from "@/lib/core/ontology/objects";
import { recordEvent } from "@/lib/core/ontology/facts";
import {
  connectorTypeKey,
  prismaConnectorStore,
  type ConnectorKey,
  type ConnectorStore,
} from "@/lib/core/ingest/connector";
import "@/lib/core/ingest/connectors";

// ---------------------------------------------------------------------------
// Foundry -> Ontology bridge.
//
// Problem it fixes: the Foundry connector framework (Phase A, F2-00001..450)
// pulled rows and wrote them straight to `OntoObject` via
// `prismaConnectorStore.upsertObjects`, bypassing the ontology engine —
// no type definition, no kind coercion, no required/unique/immutable
// enforcement, no merge-never-clobber, no audit event.
//
// This bridge makes every connector pull go through the ontology:
//  1. `ensureConnectorType` guarantees a `conn_<key>` OntoType exists,
//     evolving it non-destructively as new columns appear.
//  2. `ontologyUpsertObjects` writes via `upsertObject` (kinds +
//     merge-never-clobber), quarantining per-row failures instead of
//     throwing.
//  3. `ontologyConnectorStore` wraps the ledger/cursor store with (1)+(2),
//     so `runConnectorPull` needs no code change at call sites.
// ---------------------------------------------------------------------------

export function normalizeFieldKey(raw: string, fallbackIndex: number): string {
  let k = normalizeKey(raw);
  // Single-letter headers ("a") are meaningful — keep them as col_<letter>
  // (valid + stable) instead of falling back to a positional col_<index>.
  if (k.length === 1) k = `col_${k}`;
  if (!KEY_RE.test(k)) {
    k = `col_${fallbackIndex}`;
  }
  return k.slice(0, 64);
}

export function connectorLabel(key: ConnectorKey): string {
  const labels: Record<string, string> = {
    "csv-upload": "CSV upload",
    "xlsx-upload": "Excel upload",
    "rest-paginated": "Paginated REST",
    "rest-webhook": "Webhook inbox",
    "postgres-cdc": "Postgres CDC bridge",
    "sqlite-file": "SQLite export bridge",
    opencorporates: "OpenCorporates registry",
    courtlistener: "CourtListener dockets",
    edgar: "SEC EDGAR filings",
    gdelt: "GDELT press",
    "tms-export": "TMS export",
    "fuel-cards": "Fuel card export",
    "broker-email": "Broker email JSON",
    "eld-pings": "ELD pings JSON",
    "manual-form": "Manual form entries",
  };
  return labels[key] ?? key;
}

export async function ensureConnectorType(
  organizationId: string,
  key: ConnectorKey,
  sampleFields: string[],
  actorId = "",
): Promise<{ typeKey: string; created: boolean; added: string[] }> {
  const typeKey = connectorTypeKey(key);
  const existing = await db.ontoType.findUnique({
    where: { organizationId_key: { organizationId, key: typeKey } },
    include: { properties: true },
  });

  const wanted = new Map<string, string>();
  sampleFields.forEach((f, i) => {
    const nk = normalizeFieldKey(f, i);
    if (!wanted.has(nk)) wanted.set(nk, f);
  });

  if (!existing) {
    const properties = [...wanted.entries()].map(([propKey, label]) => ({
      key: propKey,
      label: String(label).slice(0, 120),
      kind: "string",
      required: false,
      unique: false,
      indexed: false,
      immutable: false,
    }));
    const res = await createType(organizationId, actorId, {
      key: typeKey,
      label: connectorLabel(key),
      plural: `${connectorLabel(key)} rows`,
      description: `Foundry connector landing type for ${key}. Auto-managed by ontology bridge; do not hand-edit.`,
      properties,
    });
    if (!res.ok) {
      throw new Error(`ensureConnectorType create failed: ${JSON.stringify(res)}`);
    }
    return { typeKey, created: true, added: [...wanted.keys()] };
  }

  const have = new Set(existing.properties.map((p) => p.key));
  const missing = [...wanted.entries()].filter(([k]) => !have.has(k));
  if (missing.length === 0) return { typeKey, created: false, added: [] };

  const nextProperties = [
    ...existing.properties.map((p) => ({
      key: p.key,
      label: p.label,
      kind: p.kind,
      required: p.required,
      unique: p.unique,
      indexed: p.indexed,
      immutable: p.immutable,
      config: (p.config as Record<string, unknown> | null) ?? undefined,
    })),
    ...missing.map(([propKey, label]) => ({
      key: propKey,
      label: String(label).slice(0, 120),
      kind: "string",
      required: false,
      unique: false,
      indexed: false,
      immutable: false,
      config: undefined,
    })),
  ];
  const res = await updateType(organizationId, actorId, typeKey, {
    key: typeKey,
    label: existing.label,
    plural: existing.plural,
    description: existing.description,
    properties: nextProperties,
  });
  if (!res.ok) {
    throw new Error(`ensureConnectorType evolve failed: ${JSON.stringify(res)}`);
  }
  return { typeKey, created: false, added: missing.map(([k]) => k) };
}

export interface OntologyUpsertOutcome {
  upserted: number;
  quarantined: number;
  rowErrors: Array<{ rowNumber: number; key: string; field: string; code: string; message: string }>;
}

export async function ontologyUpsertObjects(
  organizationId: string,
  typeKey: string,
  rows: Array<{ key: string; data: Record<string, string> }>,
  actorId = "",
): Promise<OntologyUpsertOutcome> {
  let upserted = 0;
  const rowErrors: OntologyUpsertOutcome["rowErrors"] = [];
  let rowNumber = 0;
  for (const r of rows) {
    rowNumber++;
    // Normalize incoming column names to valid ontology property keys so
    // raw CSV headers ("LoadID", "Pickup Date") land on the same fields
    // the ensured type carries. Unknown columns are kept — the type was
    // evolved beforehand — but never crash the pull.
    const data: Record<string, unknown> = {};
    Object.entries(r.data).forEach(([k, v], i) => {
      data[normalizeFieldKey(k, i)] = v;
    });
    const res = await upsertObject(organizationId, typeKey, { key: r.key, data });
    if (res.ok) {
      upserted++;
    } else {
      rowErrors.push({
        rowNumber,
        key: r.key,
        field: "*",
        code: "ONTOLOGY_REJECT",
        message: res.error,
      });
    }
  }
  if (upserted > 0) {
    await recordEvent(organizationId, {
      kind: "ontology:connector:upsert",
      actorId,
      after: { typeKey, upserted, quarantined: rows.length - upserted },
    }).catch(() => undefined);
  }
  return { upserted, quarantined: rows.length - upserted, rowErrors };
}

/**
 * Ledger + cursor behavior stays on the battle-tested prisma store; object
 * writes + tombstones route through the ontology engine. Drop-in for
 * `runConnectorPull(..., { store })`.
 */
export function ontologyConnectorStore(actorId = ""): ConnectorStore {
  const base = prismaConnectorStore;
  return {
    ...base,
    upsertObjects: async (orgId, typeKey, rows) => {
      // Evolve the landing type from the union of incoming columns first,
      // so validated writes never fail on "unknown property".
      const union = new Set<string>();
      for (const r of rows) for (const k of Object.keys(r.data)) union.add(k);
      await ensureConnectorType(
        orgId,
        typeKeyToConnectorKey(typeKey),
        [...union],
        actorId,
      ).catch(() => undefined);
      const out = await ontologyUpsertObjects(orgId, typeKey, rows, actorId);
      return out.upserted;
    },
    tombstoneMissing: async (orgId, typeKey, liveKeys) => {
      const stale = await db.ontoObject.findMany({
        where: { organizationId: orgId, typeKey, deletedAt: null },
        select: { id: true, key: true },
        take: 50_000,
      });
      const dead = stale.filter((r) => !liveKeys.has(r.key));
      if (dead.length === 0) return 0;
      await db.ontoObject.updateMany({
        where: { organizationId: orgId, typeKey, key: { in: dead.map((d) => d.key) } },
        data: { deletedAt: new Date() },
      });
      await recordEvent(orgId, {
        kind: "ontology:connector:tombstone",
        actorId,
        after: { typeKey, tombstoned: dead.length },
      }).catch(() => undefined);
      return dead.length;
    },
  };
}

function typeKeyToConnectorKey(typeKey: string): ConnectorKey {
  // conn_csv_upload -> csv-upload. Fallback keeps the bridge total: a direct
  // typeKey that is not a connector landing type still resolves to csv-upload
  // shape (string fields) rather than throwing inside a pull.
  const slug = typeKey.replace(/^conn_/, "").replace(/_/g, "-");
  const known: ConnectorKey[] = [
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
  ];
  return (known as string[]).includes(slug) ? (slug as ConnectorKey) : "csv-upload";
}

export async function connectorFreshnessMap(organizationId: string) {
  const types = await listTypes(organizationId, false, 500);
  const states = await db.connectorState.findMany({ where: { organizationId } });
  const byKey = new Map(states.map((s) => [s.connectorKey, s.lastPulledAt]));
  return types
    .filter((t) => t.key.startsWith("conn_"))
    .map((t) => ({
      typeKey: t.key,
      lastPulledAt: byKey.get(t.key.replace(/^conn_/, "").replace(/_/g, "-")) ?? null,
      rows: 0,
    }));
}
