import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireJson } from "@/lib/core/json-guard";
import { requireWritable } from "@/lib/core/guards";
import { executeAction } from "@/lib/core/ontology/execute";
import { executeStoredFunction } from "@/lib/core/ontology/functions-store";
import { allNativeHandlers } from "@/lib/packs/function-handlers";

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(userId);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "ontology:manage");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const guarded = requireJson(req);
  if (!guarded.ok) return guarded.response;
  const blocked = await requireWritable(active.organization.id);
  if (blocked) return blocked;
  const body = (await req.json()) as {
    actionKey?: string;
    objectId?: string;
    inputs?: unknown;
    idempotencyKey?: string;
    approvalId?: string;
    functions?: Array<{ key?: string; args?: Record<string, unknown>; version?: number }>;
  };
  if (!body.actionKey || !body.objectId || !body.idempotencyKey) {
    return NextResponse.json({ error: "actionKey, objectId, and idempotencyKey are required" }, { status: 400 });
  }
  // Function-backed actions: pre-compute $fn.* values through the registry
  // executor. A failing function fails the request — computed values are
  // never silently dropped into the write path.
  const fnValues: Record<string, unknown> = {};
  for (const f of body.functions ?? []) {
    if (!f || typeof f.key !== "string") {
      return NextResponse.json({ error: "functions entries need a string key" }, { status: 400 });
    }
    const computed = await executeStoredFunction(active.organization.id, f.key, f.args ?? {}, {
      nativeHandlers: allNativeHandlers,
      version: f.version,
    });
    if (!computed.ok) {
      return NextResponse.json({ error: `function ${f.key} failed: ${computed.error}` }, { status: 400 });
    }
    fnValues[f.key] = computed.value;
  }
  const res = await executeAction(active.organization.id, userId, {
    actionKey: body.actionKey,
    objectId: body.objectId,
    inputs: body.inputs,
    idempotencyKey: body.idempotencyKey,
    approvalId: body.approvalId,
    fnValues,
  });
  if (!res.ok) {
    const status = "needsApproval" in res && res.needsApproval ? 409 : 400;
    return NextResponse.json({ error: res.error }, { status });
  }
  await logAccess(active.organization.id, userId, "ontology:action:execute", body.actionKey);
  return NextResponse.json({ run: res.value, replayed: res.replayed });
}
