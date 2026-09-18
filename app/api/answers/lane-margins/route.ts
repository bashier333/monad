import { NextResponse } from "next/server";
import { getWeeklyAnswer, resolveWeek } from "@/lib/answers/service";
import { auth } from "@/lib/auth";
import { recordUsage } from "@/lib/billing";
import { logger } from "@/lib/logger";
import { getActiveOrg } from "@/lib/org";
import { historyBlocked } from "@/lib/guards";
import { stampFirstAnswer } from "@/lib/pilots";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });

  const url = new URL(req.url);
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
