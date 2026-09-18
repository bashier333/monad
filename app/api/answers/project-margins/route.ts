import { NextResponse } from "next/server";
import { getAgencyAnswer } from "@/lib/packs/agency/service";
import { packEnabled } from "@/lib/core/packs";
import { resolveWeek } from "@/lib/core/answers/service";
import { auth } from "@/lib/core/auth";
import { recordUsage } from "@/lib/core/billing";
import { logger } from "@/lib/core/logger";
import { getActiveOrg } from "@/lib/core/org";
import { historyBlocked } from "@/lib/core/guards";
import { stampFirstAnswer } from "@/lib/core/pilots";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });

  if (!packEnabled(active.organization.settings, "agency")) {
    return NextResponse.json({ error: "agency pack is disabled for this organization" }, { status: 403 });
  }

  const url = new URL(req.url);
  let anchor: string;
  try {
    anchor = resolveWeek(url.searchParams.get("week"));
  } catch {
    return NextResponse.json({ error: "invalid week parameter (use YYYY-MM-DD)" }, { status: 400 });
  }
  const now = new Date().toISOString().slice(0, 10);
  if (anchor > now) {
    return NextResponse.json({ projects: [], totals: null, meta: null, note: "future period — no data yet" });
  }

  const settings = (active.organization.settings ?? {}) as { agencyWeekStartsOn?: number };
  const answer = await getAgencyAnswer(active.organization.id, settings.agencyWeekStartsOn ?? active.organization.weekStartsOn, anchor);
  if (await historyBlocked(active.organization.id, answer.meta.weekStart)) {
    return NextResponse.json({ error: "free tier: 90-day history — upgrade to Team for full history" }, { status: 402 });
  }
  await recordUsage(active.organization.id, "answer_view", 1, "agency");
  await stampFirstAnswer(active.organization.id);
  logger.info("agency answer viewed", {
    requestId: req.headers.get("x-request-id") ?? "none",
    orgId: active.organization.id,
    week: answer.meta.weekStart,
  });
  return NextResponse.json(answer);
}
