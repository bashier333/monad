import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireJson } from "@/lib/core/json-guard";
import { requireWritable } from "@/lib/core/guards";
import { listAutomations, setAutomationPaused } from "@/lib/core/automations/store";
import { automationTickDeps } from "@/scripts/automation-wiring";
import { fireAutomation } from "@/lib/core/automations/runner";

export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "answer:view");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { key } = await ctx.params;
  const found = (await listAutomations(active.organization.id)).find((s) => s.key === key);
  if (!found) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ automation: found });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "board:manage");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const guarded = requireJson(req);
  if (!guarded.ok) return guarded.response;
  const blocked = await requireWritable(active.organization.id);
  if (blocked) return blocked;
  const { key } = await ctx.params;
  const body = (await req.json()) as { paused?: unknown };
  if (typeof body.paused !== "boolean") {
    return NextResponse.json({ error: "paused boolean is required" }, { status: 400 });
  }
  const res = await setAutomationPaused(active.organization.id, session.user.id, key, body.paused);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 404 });
  await logAccess(active.organization.id, session.user.id, "automation:pause", key);
  return NextResponse.json({ automation: res.value });
}

export async function POST(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "board:manage");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const guarded = requireJson(req);
  if (!guarded.ok) return guarded.response;
  const blocked = await requireWritable(active.organization.id);
  if (blocked) return blocked;
  const { key } = await ctx.params;
  const deps = automationTickDeps(active.organization.id, "ops");
  const specs = await deps.listSpecs();
  const spec = specs.find((s) => s.key === key);
  if (!spec) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { args?: Record<string, unknown> };
  const record = await fireAutomation(
    spec,
    { trigger: "manual", args: body.args ?? {}, nowMs: Date.now(), recentFiredAtMs: [] },
    deps.runners,
  );
  await deps.recordRun(record);
  await logAccess(active.organization.id, session.user.id, "automation:run", key);
  return NextResponse.json({ run: record });
}
