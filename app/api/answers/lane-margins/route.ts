import { NextResponse } from "next/server";
import { getWeeklyAnswer } from "@/lib/packs/freight/service"; import { resolveWeek } from "@/lib/core/answers/service";
import { packEnabled } from "@/lib/core/packs";
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

  const url = new URL(req.url);
  if (!packEnabled(active.organization.settings, "freight")) {
    return NextResponse.json({ error: "freight pack is disabled for this organization" }, { status: 403 });
  }
  let anchor: string;
  try {
    anchor = resolveWeek(url.searchParams.get("week"));
  } catch {
    return NextResponse.json({ error: "invalid week parameter (use YYYY-MM-DD)" }, { status: 400 });
  }

  const answer = await getWeeklyAnswer(active.organization.id, active.organization.weekStartsOn, anchor);
  if (await historyBlocked(active.organization.id, answer.meta.weekStart)) {
    return NextResponse.json({ error: "free tier: 90-day history — upgrade to Team for full history" }, { status: 402 });
  }
  await recordUsage(active.organization.id, "answer_view");
  await stampFirstAnswer(active.organization.id);
  const { loads: _loads, ...rest } = answer;
  void _loads;
  logger.info("answer viewed", {
    requestId: req.headers.get("x-request-id") ?? "none",
    orgId: active.organization.id,
    week: answer.meta.weekStart,
  });
  return NextResponse.json(rest);
}
