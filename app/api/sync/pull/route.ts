import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireWritable } from "@/lib/core/guards";
import { logAccess } from "@/lib/core/access";
import { requireJson } from "@/lib/core/json-guard";
import {
  connectorFreshness,
  getConnector,
  isConnectorKey,
  runConnectorPull,
} from "@/lib/core/ingest/connector";
import "@/lib/core/ingest/connectors";
import {
  connectorLabel,
  ensureConnectorType,
  ontologyConnectorStore,
} from "@/lib/core/ingest/ontology-bridge";

// POST /api/sync/pull — Foundry connector pull wired into the ontology.
//
// Body: { connectorKey, sourceText?, sourceEncoding?, endpoint?,
//         dateFrom?, dateTo?, dryRun?, fullRefresh?, cursor? }
// Every pulled row lands as a validated `conn_<key>` OntoObject
// (kind coercion + merge-never-clobber + audit); ledger rows stay
// queryable at GET /api/sync/runs.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "upload:import");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const blocked = await requireWritable(active.organization.id);
  if (blocked) return blocked;

  const guard = requireJson(req);
  if (!guard.ok) return guard.response;
  const body = (await req.json()) as {
    connectorKey?: unknown;
    sourceText?: unknown;
    sourceEncoding?: unknown;
    endpoint?: unknown;
    dateFrom?: unknown;
    dateTo?: unknown;
    dryRun?: unknown;
    fullRefresh?: unknown;
    cursor?: unknown;
  };

  if (typeof body.connectorKey !== "string" || !isConnectorKey(body.connectorKey)) {
    return NextResponse.json({ error: "connectorKey must be a known Foundry connector" }, { status: 400 });
  }
  const def = getConnector(body.connectorKey);
  if (!def) return NextResponse.json({ error: "unknown connector" }, { status: 400 });

  const requestId = req.headers.get("x-request-id") ?? "none";
  const orgId = active.organization.id;
  const actorId = session.user.id;

  // Ensure the landing type exists before the pull so Studio/Explore can
  // render rows immediately, even on a dry run that writes nothing.
  const typeKey = `conn_${body.connectorKey.replace(/-/g, "_")}`;
  try {
    await ensureConnectorType(orgId, body.connectorKey, [], actorId);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed to ensure ontology type" },
      { status: 500 },
    );
  }

  const store = ontologyConnectorStore(actorId);
  const summary = await runConnectorPull(
    def,
    {
      key: body.connectorKey,
      organizationId: orgId,
      sourceText: typeof body.sourceText === "string" ? body.sourceText : undefined,
      sourceEncoding: body.sourceEncoding === "base64" ? "base64" : undefined,
      endpoint: typeof body.endpoint === "string" ? body.endpoint : undefined,
      dateFrom: typeof body.dateFrom === "string" ? body.dateFrom : undefined,
      dateTo: typeof body.dateTo === "string" ? body.dateTo : undefined,
      dryRun: body.dryRun === true ? true : undefined,
      fullRefresh: body.fullRefresh === true ? true : undefined,
      cursor: typeof body.cursor === "string" ? body.cursor : undefined,
      triggeredById: actorId,
    },
    {
      store,
      notify: async () => undefined,
    },
  );

  const lastPulledAt = await store.lastPulledAt(orgId, body.connectorKey);
  const freshness = connectorFreshness(lastPulledAt, Date.now(), def.freshnessSlaMs);

  await logAccess(orgId, actorId, "sync:pull", `${body.connectorKey}:${summary.status}`, requestId);
  return NextResponse.json({
    ok: summary.status !== "FAILED",
    connectorKey: body.connectorKey,
    label: connectorLabel(body.connectorKey),
    typeKey,
    ...summary,
    freshness: freshness.state,
  });
}
