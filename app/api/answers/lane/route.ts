import { NextResponse } from "next/server";
import { getWeeklyAnswer } from "@/lib/packs/freight/service"; import { resolveWeek } from "@/lib/core/answers/service";
import { laneKey } from "@/lib/packs/freight/margin/places";
import { auth } from "@/lib/core/auth";
import { recordUsage } from "@/lib/core/billing";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";
import { historyBlocked } from "@/lib/core/guards";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });

  const url = new URL(req.url);
  const laneParam = url.searchParams.get("lane");
  if (!laneParam) return NextResponse.json({ error: "missing lane parameter" }, { status: 400 });
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
  const lane = answer.lanes.find((l) => l.lane === laneParam);
  if (!lane) return NextResponse.json({ error: "lane not found for this week" }, { status: 404 });

  const loads = answer.loads.filter(
    (l) => laneKey(l.origin, l.destination) === laneParam,
  );
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 500), 1), 2000);
  const cursor = Math.max(Number(url.searchParams.get("cursor") ?? 0), 0);
  const page = loads.slice(cursor, cursor + limit);

  const prevAnchor = new Date(`${answer.meta.weekStart}T00:00:00Z`);
  prevAnchor.setUTCDate(prevAnchor.getUTCDate() - 7);
  const prev = await getWeeklyAnswer(
    active.organization.id,
    active.organization.weekStartsOn,
    prevAnchor.toISOString().slice(0, 10),
  );
  const prevLane = prev.lanes.find((l) => l.lane === laneParam);

  const touched = await db.stagedRecord.findMany({
    where: { organizationId: active.organization.id, loadKey: { in: lane.loadKeys.slice(0, 500) } },
    select: { loadKey: true, runId: true },
    take: 2000,
  });
  const runIds = [...new Set(touched.map((t) => t.runId))];
  const runs = await db.importRun.findMany({
    where: { id: { in: runIds } },
    select: { id: true, sourceType: true, status: true, createdAt: true, file: { select: { filename: true } } },
    orderBy: { createdAt: "desc" },
  });

  const drivers = [...loads]
    .flatMap((l) => l.costs.map((c) => ({ loadKey: l.loadKey, kind: c.kind, label: c.label, amount: c.amount })))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  return NextResponse.json({
    meta: answer.meta,
    lane,
    loads: page,
    totalLoads: loads.length,
    nextCursor: cursor + limit < loads.length ? cursor + limit : null,
    drivers,
    weekOverWeek: prevLane
      ? { prevMargin: prevLane.margin, prevMarginPct: prevLane.marginPct, delta: Math.round((lane.margin - prevLane.margin) * 100) / 100 }
      : null,
    recentImports: runs,
    appliedRules: answer.appliedRules,
  });
}
