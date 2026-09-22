import { NextResponse } from "next/server";
import { runPlaybook } from "@/lib/core/workflow";
import { buildPlaybookExecutors } from "@/lib/packs/playbook-executors";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireWritable } from "@/lib/core/guards";
import { requireJson } from "@/lib/core/json-guard";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  const pb = await db.workflowPlaybook.findFirst({
    where: { id, orgId: active.organization.id },
    include: { runs: { orderBy: { createdAt: "desc" }, take: 20 } },
  });
  if (!pb) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ playbook: pb });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const guardedJson1 = requireJson(req);
  if (!guardedJson1.ok) return guardedJson1.response;
  const body = (await req.json().catch(() => ({}))) as { dryRun?: boolean };
  const requestId = req.headers.get("x-request-id") ?? "none";
  const out = await runPlaybook(id, active.organization.id, requestId, body.dryRun === true, buildPlaybookExecutors(active.organization.id));
  await logAccess(active.organization.id, session.user.id, "playbook:run", `${id}:${out.status}`);
  return NextResponse.json(out);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "upload:import");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const pb = await db.workflowPlaybook.findFirst({ where: { id, orgId: active.organization.id } });
  if (!pb) return NextResponse.json({ error: "not found" }, { status: 404 });
  await db.workflowRun.deleteMany({ where: { playbookId: id } });
  await db.workflowPlaybook.delete({ where: { id } });
  await logAccess(active.organization.id, session.user.id, "playbook:delete", id);
  return NextResponse.json({ ok: true });
}
