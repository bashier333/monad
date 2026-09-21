import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireJson } from "@/lib/core/json-guard";
import { requireWritable } from "@/lib/core/guards";
import { canExecuteVerb, executeManufacturingAction, MANUFACTURING_ACTIONS } from "@/lib/packs/manufacturing/actions";

// Human confirmation for agent-proposed actions. The agent describes; this
// endpoint performs the governed write-back (approval + idempotency + audit)
// through the manufacturing action executor.
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(userId);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
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
    approve?: boolean;
  };
  if (body.approve !== true) {
    return NextResponse.json({ error: "approve must be true to confirm a proposed action" }, { status: 400 });
  }
  if (!body.actionKey || !body.objectId || !body.idempotencyKey) {
    return NextResponse.json({ error: "actionKey, objectId, and idempotencyKey are required" }, { status: 400 });
  }
  // Per-verb roles replace the blanket OWNER gate: owners pass every verb via
  // canExecuteVerb, dispatchers pass verbs that list them, viewers pass none.
  // The generic actions/execute endpoint keeps its ontology:manage gate.
  const spec = MANUFACTURING_ACTIONS.find((a) => a.key === body.actionKey);
  if (!spec) return NextResponse.json({ error: "unknown manufacturing action" }, { status: 400 });
  if (spec.latitude === "never") return NextResponse.json({ error: `${spec.key} is disabled by policy` }, { status: 403 });
  try {
    requireCan(active.membership.role, "ontology:manage");
  } catch {
    if (!canExecuteVerb(active.membership.role, spec)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }
  const res = await executeManufacturingAction(
    active.organization.id,
    userId,
    body.actionKey,
    body.objectId,
    body.inputs,
    body.idempotencyKey,
    body.approvalId,
    { actorRole: active.membership.role }
  );
  if (!res.ok) {
    const forbidden = typeof res.error === "string" && res.error.startsWith("role ");
    const status = res.needsApproval ? 409 : forbidden ? 403 : 400;
    return NextResponse.json({ error: res.error, approvalId: res.approvalId }, { status });
  }
  await logAccess(active.organization.id, userId, "agent:confirm", `${body.actionKey}:${res.runId ?? "replayed"}`);
  return NextResponse.json(res);
}
