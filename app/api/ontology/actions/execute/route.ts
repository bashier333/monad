import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireJson } from "@/lib/core/json-guard";
import { requireWritable } from "@/lib/core/guards";
import { executeAction } from "@/lib/core/ontology/execute";

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
  };
  if (!body.actionKey || !body.objectId || !body.idempotencyKey) {
    return NextResponse.json({ error: "actionKey, objectId, and idempotencyKey are required" }, { status: 400 });
  }
  const res = await executeAction(active.organization.id, userId, {
    actionKey: body.actionKey,
    objectId: body.objectId,
    inputs: body.inputs,
    idempotencyKey: body.idempotencyKey,
    approvalId: body.approvalId,
  });
  if (!res.ok) {
    const status = "needsApproval" in res && res.needsApproval ? 409 : 400;
    return NextResponse.json({ error: res.error }, { status });
  }
  await logAccess(active.organization.id, userId, "ontology:action:execute", body.actionKey);
  return NextResponse.json({ run: res.value, replayed: res.replayed });
}
