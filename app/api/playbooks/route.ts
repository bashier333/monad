import { NextResponse } from "next/server";
import { STARTER_PLAYBOOKS, validatePlaybookSteps } from "@/lib/core/workflow";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireJson } from "@/lib/core/json-guard";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  const playbooks = await db.workflowPlaybook.findMany({
    where: { orgId: active.organization.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { runs: true } } },
  });
  return NextResponse.json({ playbooks, starters: STARTER_PLAYBOOKS });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "upload:import");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const guardedJson1 = requireJson(req);
  if (!guardedJson1.ok) return guardedJson1.response;
  const body = (await req.json()) as { name?: string; steps?: unknown; schedule?: string; fromStarter?: number };
  let name = String(body.name ?? "").slice(0, 80);
  let steps = body.steps;
  let schedule: string | null = typeof body.schedule === "string" ? body.schedule.slice(0, 40) : null;
  if (typeof body.fromStarter === "number" && STARTER_PLAYBOOKS[body.fromStarter]) {
    const starter = STARTER_PLAYBOOKS[body.fromStarter];
    name = name || starter.name;
    steps = starter.steps;
    schedule = schedule ?? starter.schedule;
  }
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const parsed = validatePlaybookSteps(steps);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const created = await db.workflowPlaybook.create({
    data: { orgId: active.organization.id, name, steps: parsed.steps as unknown as object, schedule },
  });
  await logAccess(active.organization.id, session.user.id, "playbook:create", created.id);
  return NextResponse.json({ playbook: created });
}
