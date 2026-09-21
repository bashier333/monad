import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireJson } from "@/lib/core/json-guard";
import { requireWritable } from "@/lib/core/guards";
import { validateAlertRule, type AlertRuleInput } from "@/lib/core/workflow";

async function context() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const active = await getActiveOrg(userId);
  if (!active) return { error: NextResponse.json({ error: "no organization" }, { status: 400 }) };
  return { userId, active };
}

export async function GET() {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const full = ctx as Exclude<typeof ctx, { error: unknown }>;
  const rules = await db.alertRule.findMany({
    where: { orgId: full.active.organization.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ rules });
}

export async function POST(req: Request) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const full = ctx as Exclude<typeof ctx, { error: unknown }>;
  try {
    requireCan(full.active.membership.role, "upload:import");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const guarded = requireJson(req);
  if (!guarded.ok) return guarded.response;
  const blocked = await requireWritable(full.active.organization.id);
  if (blocked) return blocked;
  const body = (await req.json()) as AlertRuleInput;
  const parsed = validateAlertRule(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const created = await db.alertRule.create({
    data: {
      orgId: full.active.organization.id,
      pack: parsed.value.pack,
      metric: parsed.value.metric,
      op: parsed.value.op,
      threshold: parsed.value.threshold,
      channel: parsed.value.channel,
      owner: parsed.value.owner,
      responseAction: parsed.value.responseAction,
      windowMinutes: parsed.value.windowMinutes,
      active: true,
    },
  });
  await logAccess(full.active.organization.id, full.userId, "alert:create", created.id);
  return NextResponse.json({ rule: created }, { status: 201 });
}

export async function PATCH(req: Request) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const full = ctx as Exclude<typeof ctx, { error: unknown }>;
  try {
    requireCan(full.active.membership.role, "upload:import");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const guarded = requireJson(req);
  if (!guarded.ok) return guarded.response;
  const blocked = await requireWritable(full.active.organization.id);
  if (blocked) return blocked;
  const body = (await req.json()) as { id?: string; active?: boolean };
  if (!body.id || typeof body.active !== "boolean") {
    return NextResponse.json({ error: "id and active are required" }, { status: 400 });
  }
  const rule = await db.alertRule.findFirst({ where: { id: body.id, orgId: full.active.organization.id } });
  if (!rule) return NextResponse.json({ error: "not found" }, { status: 404 });
  const updated = await db.alertRule.update({ where: { id: rule.id }, data: { active: body.active } });
  await logAccess(full.active.organization.id, full.userId, "alert:toggle", rule.id);
  return NextResponse.json({ rule: updated });
}

export async function DELETE(req: Request) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const full = ctx as Exclude<typeof ctx, { error: unknown }>;
  try {
    requireCan(full.active.membership.role, "upload:import");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const blocked = await requireWritable(full.active.organization.id);
  if (blocked) return blocked;
  const rule = await db.alertRule.findFirst({ where: { id, orgId: full.active.organization.id } });
  if (!rule) return NextResponse.json({ error: "not found" }, { status: 404 });
  await db.alertRule.delete({ where: { id: rule.id } });
  await logAccess(full.active.organization.id, full.userId, "alert:delete", rule.id);
  return NextResponse.json({ ok: true });
}
