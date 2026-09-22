import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireJson } from "@/lib/core/json-guard";
import { requireWritable } from "@/lib/core/guards";
import { automationHistory, defineAutomation, listAutomations } from "@/lib/core/automations/store";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "answer:view");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  if (url.searchParams.get("history") === "1") {
    const take = Math.min(Math.max(Number.parseInt(url.searchParams.get("take") ?? "50", 10) || 50, 1), 200);
    return NextResponse.json({ history: await automationHistory(active.organization.id, take) });
  }
  return NextResponse.json({ automations: await listAutomations(active.organization.id) });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  const userId = session.user.id;
  try {
    requireCan(active.membership.role, "board:manage");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const guarded = requireJson(req);
  if (!guarded.ok) return guarded.response;
  const blocked = await requireWritable(active.organization.id);
  if (blocked) return blocked;
  const body = (await req.json()) as unknown;
  const res = await defineAutomation(active.organization.id, userId, body);
  if (!res.ok) {
    return NextResponse.json({ error: "invalid", problems: res.problems }, { status: 400 });
  }
  await logAccess(active.organization.id, userId, "automation:define", res.value.key);
  return NextResponse.json({ automation: res.value }, { status: 201 });
}
