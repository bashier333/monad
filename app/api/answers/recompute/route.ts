import { NextResponse } from "next/server";
import { getWeeklyAnswer, getFreightForecast } from "@/lib/packs/freight/service"; import { resolveWeek } from "@/lib/core/answers/service";
import { getAgencyAnswer, getAgencyForecast } from "@/lib/packs/agency/service";
import { cacheBust } from "@/lib/core/cache";
import { logAccess } from "@/lib/core/access";
import { auth } from "@/lib/core/auth";
import { recordUsage } from "@/lib/core/billing";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireWritable } from "@/lib/core/guards";

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

  const body = (await req.json()) as { week?: string; pack?: string };
  let anchor: string;
  try {
    anchor = resolveWeek(body.week ?? null);
  } catch {
    return NextResponse.json({ error: "invalid week parameter" }, { status: 400 });
  }

  if (body.pack === "agency") {
    cacheBust(`answer:agency:${active.organization.id}:`);
    const answer = await getAgencyAnswer(active.organization.id, active.organization.weekStartsOn, anchor);
    await recordUsage(active.organization.id, "recompute", 1, "agency");
    await logAccess(active.organization.id, session.user.id, "answer:recompute", `agency:${anchor}`, req.headers.get("x-request-id") ?? "none");
    return NextResponse.json({
      meta: answer.meta,
      totals: answer.totals,
      appliedCorrections: answer.adjustments.length,
      adjustments: answer.adjustments,
    });
  }

  const answer = await getWeeklyAnswer(active.organization.id, active.organization.weekStartsOn, anchor);
  await recordUsage(active.organization.id, "recompute");
  await logAccess(active.organization.id, session.user.id, "answer:recompute", `freight:${anchor}`, req.headers.get("x-request-id") ?? "none");
  return NextResponse.json({
    meta: answer.meta,
    totals: answer.totals,
    appliedCorrections: answer.adjustments.length,
    adjustments: answer.adjustments,
  });
}
