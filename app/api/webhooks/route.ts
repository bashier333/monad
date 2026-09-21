import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireJson } from "@/lib/core/json-guard";
import { requireWritable } from "@/lib/core/guards";
import { validateWebhookUrl } from "@/lib/core/ontology/webhooks";
import { MANUFACTURING_ACTIONS } from "@/lib/packs/manufacturing/actions";

async function context(): Promise<
  | { ok: true; userId: string; orgId: string; role: Parameters<typeof requireCan>[0] }
  | { ok: false; response: NextResponse }
> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const active = await getActiveOrg(userId);
  if (!active) return { ok: false, response: NextResponse.json({ error: "no organization" }, { status: 400 }) };
  return { ok: true, userId, orgId: active.organization.id, role: active.membership.role };
}

function guardManage(role: Parameters<typeof requireCan>[0]) {
  try {
    requireCan(role, "ontology:manage");
    return null;
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
}

// One pre-commit webhook per action verb: the owning external system signs
// off on (or vetoes) the write before it commits.
export async function GET() {
  const ctx = await context();
  if (!ctx.ok) return ctx.response;
  const hooks = await db.ontoWebhook.findMany({
    where: { organizationId: ctx.orgId },
    orderBy: { actionKey: "asc" },
  });
  return NextResponse.json({
    verbs: MANUFACTURING_ACTIONS.map((a) => a.key),
    webhooks: hooks.map((h) => ({
      id: h.id,
      actionKey: h.actionKey,
      url: h.url,
      active: h.active,
      lastStatus: h.lastStatus,
      lastAt: h.lastAt?.toISOString() ?? null,
    })),
  });
}

export async function POST(req: Request) {
  const ctx = await context();
  if (!ctx.ok) return ctx.response;
  const forbidden = guardManage(ctx.role);
  if (forbidden) return forbidden;
  const guarded = requireJson(req);
  if (!guarded.ok) return guarded.response;
  const blocked = await requireWritable(ctx.orgId);
  if (blocked) return blocked;
  const body = (await req.json()) as { actionKey?: string; url?: string; secret?: string };
  if (!body.actionKey || !MANUFACTURING_ACTIONS.some((a) => a.key === body.actionKey)) {
    return NextResponse.json({ error: "actionKey must be a manufacturing verb" }, { status: 400 });
  }
  const valid = validateWebhookUrl(String(body.url ?? ""));
  if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 });
  const hook = await db.ontoWebhook.upsert({
    where: { organizationId_actionKey: { organizationId: ctx.orgId, actionKey: body.actionKey } },
    create: {
      organizationId: ctx.orgId,
      actionKey: body.actionKey,
      url: String(body.url),
      secret: String(body.secret ?? ""),
    },
    update: { url: String(body.url), secret: String(body.secret ?? ""), active: true },
  });
  await logAccess(ctx.orgId, ctx.userId, "webhook:upsert", body.actionKey);
  return NextResponse.json({ webhook: { id: hook.id, actionKey: hook.actionKey, url: hook.url, active: hook.active } }, { status: 201 });
}

export async function PATCH(req: Request) {
  const ctx = await context();
  if (!ctx.ok) return ctx.response;
  const forbidden = guardManage(ctx.role);
  if (forbidden) return forbidden;
  const guarded = requireJson(req);
  if (!guarded.ok) return guarded.response;
  const blocked = await requireWritable(ctx.orgId);
  if (blocked) return blocked;
  const body = (await req.json()) as { id?: string; active?: boolean };
  if (!body.id || typeof body.active !== "boolean") {
    return NextResponse.json({ error: "id and active are required" }, { status: 400 });
  }
  const hook = await db.ontoWebhook.findFirst({ where: { id: body.id, organizationId: ctx.orgId } });
  if (!hook) return NextResponse.json({ error: "not found" }, { status: 404 });
  const updated = await db.ontoWebhook.update({ where: { id: hook.id }, data: { active: body.active } });
  await logAccess(ctx.orgId, ctx.userId, "webhook:toggle", hook.id);
  return NextResponse.json({ webhook: { id: updated.id, active: updated.active } });
}

export async function DELETE(req: Request) {
  const ctx = await context();
  if (!ctx.ok) return ctx.response;
  const forbidden = guardManage(ctx.role);
  if (forbidden) return forbidden;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const blocked = await requireWritable(ctx.orgId);
  if (blocked) return blocked;
  const hook = await db.ontoWebhook.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!hook) return NextResponse.json({ error: "not found" }, { status: 404 });
  await db.ontoWebhook.delete({ where: { id: hook.id } });
  await logAccess(ctx.orgId, ctx.userId, "webhook:delete", hook.id);
  return NextResponse.json({ ok: true });
}
