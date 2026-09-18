import { NextResponse } from "next/server";
import { getWeeklyAnswer, resolveWeek } from "@/lib/answers/service";
import { auth } from "@/lib/auth";
import { recordUsage } from "@/lib/billing";
import { getActiveOrg } from "@/lib/org";
import { requireCan } from "@/lib/roles";
import { requireWritable } from "@/lib/guards";

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
  const blocked = await requireWritable(active.organization.id);
  if (blocked) return blocked;

  const body = (await req.json()) as { week?: string };
  let anchor: string;
  try {
    anchor = resolveWeek(body.week ?? null);
  } catch {
    return NextResponse.json({ error: "invalid week parameter" }, { status: 400 });
  }

  const answer = await getWeeklyAnswer(active.organization.id, active.organization.weekStartsOn, anchor);
  await recordUsage(active.organization.id, "recompute");
  return NextResponse.json({
    meta: answer.meta,
    totals: answer.totals,
    appliedCorrections: answer.adjustments.length,
    adjustments: answer.adjustments,
  });
}
