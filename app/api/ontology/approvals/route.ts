import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireJson } from "@/lib/core/json-guard";
import { requireWritable } from "@/lib/core/guards";
import { decideApproval, requestApproval } from "@/lib/core/ontology/execute";

async function context() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const active = await getActiveOrg(userId);
  if (!active) return { error: NextResponse.json({ error: "no organization" }, { status: 400 }) };
  return { userId, active };
}

export async function GET(req: Request) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const full = ctx as Exclude<typeof ctx, { error: unknown }>;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const approvals = await db.ontoApproval.findMany({
    where: { organizationId: full.active.organization.id, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ approvals });
}

export async function POST(req: Request) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const full = ctx as Exclude<typeof ctx, { error: unknown }>;
  try {
    requireCan(full.active.membership.role, "ontology:manage");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const guarded = requireJson(req);
  if (!guarded.ok) return guarded.response;
  const blocked = await requireWritable(full.active.organization.id);
  if (blocked) return blocked;
  const body = (await req.json()) as {
    actionKey?: string;
    objectId?: string;
    inputs?: unknown;
    requiredCount?: number;
    expiresAt?: string;
  };
  if (!body.actionKey || !body.objectId) {
    return NextResponse.json({ error: "actionKey and objectId are required" }, { status: 400 });
  }
  const res = await requestApproval(full.active.organization.id, full.userId, {
    actionKey: body.actionKey,
    objectId: body.objectId,
    inputs: body.inputs,
    requiredCount: body.requiredCount,
    expiresAt: body.expiresAt,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  await logAccess(full.active.organization.id, full.userId, "ontology:approval:request", body.actionKey);
  return NextResponse.json({ approval: res.value }, { status: 201 });
}

export async function PATCH(req: Request) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const full = ctx as Exclude<typeof ctx, { error: unknown }>;
  try {
    requireCan(full.active.membership.role, "ontology:manage");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const guarded = requireJson(req);
  if (!guarded.ok) return guarded.response;
  const blocked = await requireWritable(full.active.organization.id);
  if (blocked) return blocked;
  const body = (await req.json()) as { id?: string; approve?: boolean; comment?: string };
  if (!body.id || typeof body.approve !== "boolean") {
    return NextResponse.json({ error: "id and approve are required" }, { status: 400 });
  }
  const res = await decideApproval(full.active.organization.id, body.id, full.userId, body.approve, body.comment ?? "");
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  await logAccess(full.active.organization.id, full.userId, "ontology:approval:decide", body.id);
  return NextResponse.json({ approval: res.value });
}
