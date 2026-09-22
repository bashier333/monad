import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";
import { logAccess } from "@/lib/core/access";
import { requireJson } from "@/lib/core/json-guard";
import { dryRunSet, canAutoExecute, type ActionEffect } from "@/lib/core/ontology/actions";
import { resolveEffect } from "@/lib/core/ontology/execute";
import { executeStoredFunction } from "@/lib/core/ontology/functions-store";
import { allNativeHandlers } from "@/lib/packs/function-handlers";
import { previewManufacturingAction } from "@/lib/packs/manufacturing/actions";

// Dry-run preview for action forms: validates inputs and shows the changes
// that would apply, without writing anything.
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(userId);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  const guarded = requireJson(req);
  if (!guarded.ok) return guarded.response;
  const body = (await req.json()) as { actionKey?: string; objectId?: string; inputs?: unknown; functions?: Array<{ key?: string; args?: Record<string, unknown>; version?: number }> };
  if (!body.actionKey || !body.objectId) {
    return NextResponse.json({ error: "actionKey and objectId are required" }, { status: 400 });
  }
  const orgId = active.organization.id;

  if (body.actionKey.startsWith("mfg_")) {
    const preview = await previewManufacturingAction(orgId, body.actionKey, body.objectId, body.inputs);
    if (!preview.ok) return NextResponse.json({ error: preview.error }, { status: 400 });
    await logAccess(orgId, userId, "ontology:action:preview", String(body.actionKey));
    return NextResponse.json({ preview });
  }

  const action = await db.ontoAction.findUnique({
    where: { organizationId_key: { organizationId: orgId, key: body.actionKey } },
  });
  if (!action || !action.enabled) return NextResponse.json({ error: "unknown or disabled action" }, { status: 404 });
  const object = await db.ontoObject.findFirst({
    where: { id: body.objectId, organizationId: orgId, typeKey: action.targetTypeKey, deletedAt: null },
  });
  if (!object) return NextResponse.json({ error: "object not found for action target" }, { status: 404 });
  const inputs = (body.inputs as Record<string, unknown>) ?? {};
  const fnValues: Record<string, unknown> = {};
  for (const f of body.functions ?? []) {
    if (!f || typeof f.key !== "string") {
      return NextResponse.json({ error: "functions entries need a string key" }, { status: 400 });
    }
    const computed = await executeStoredFunction(orgId, f.key, f.args ?? {}, {
      nativeHandlers: allNativeHandlers,
      version: f.version,
    });
    if (!computed.ok) {
      return NextResponse.json({ error: `function ${f.key} failed: ${computed.error}` }, { status: 400 });
    }
    fnValues[f.key] = computed.value;
  }
  const changes: Array<{ effect: string; before: unknown; after: unknown }> = [];
  for (const e of action.effects as unknown[] as ActionEffect[]) {
    const r = resolveEffect(e, inputs, fnValues);
    if (!r.value) continue;
    changes.push(...dryRunSet((object.data as Record<string, unknown>) ?? {}, [r.value]));
  }
  await logAccess(orgId, userId, "ontology:action:preview", String(body.actionKey));
  return NextResponse.json({
    preview: {
      changes,
      approvalRequired: action.approvalPolicy !== "none",
      approvalPolicy: action.approvalPolicy,
      autoEligible: canAutoExecute(action.approvalPolicy, action.enabled),
    },
  });
}
