import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireJson } from "@/lib/core/json-guard";
import { requireWritable } from "@/lib/core/guards";
import { validateActionDef } from "@/lib/core/ontology/actions";
import { defineAction } from "@/lib/core/ontology/execute";

async function context() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const active = await getActiveOrg(userId);
  if (!active) return { error: NextResponse.json({ error: "no organization" }, { status: 400 }) };
  return { userId, active };
}

function guardRole(ctx: Exclude<Awaited<ReturnType<typeof context>>, { error: unknown }>) {
  try {
    requireCan(ctx.active.membership.role, "ontology:manage");
    return null;
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
}

export async function GET() {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const actions = await db.ontoAction.findMany({
    where: { organizationId: (ctx as Exclude<typeof ctx, { error: unknown }>).active.organization.id },
    orderBy: { key: "asc" },
  });
  return NextResponse.json({ actions });
}

export async function POST(req: Request) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const full = ctx as Exclude<typeof ctx, { error: unknown }>;
  const forbidden = guardRole(full);
  if (forbidden) return forbidden;
  const guarded = requireJson(req);
  if (!guarded.ok) return guarded.response;
  const blocked = await requireWritable(full.active.organization.id);
  if (blocked) return blocked;
  const body = (await req.json()) as unknown;
  const parsed = validateActionDef(body);
  if (!parsed.ok) return NextResponse.json({ error: "invalid", problems: parsed.problems }, { status: 400 });
  const res = await defineAction(full.active.organization.id, {
    key: parsed.value.key,
    label: parsed.value.label,
    targetTypeKey: parsed.value.targetTypeKey,
    inputs: parsed.value.inputs,
    effects: parsed.value.effects,
    approvalPolicy: parsed.value.approvalPolicy,
    requiredCount: parsed.value.requiredCount,
  });
  await logAccess(full.active.organization.id, full.userId, "ontology:action:define", parsed.value.key);
  return NextResponse.json({ action: res.value, created: res.created }, { status: res.created ? 201 : 200 });
}
