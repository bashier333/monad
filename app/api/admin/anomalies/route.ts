import { NextResponse } from "next/server";
import type { BriefContent } from "@/lib/core/brief/content";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "billing:manage");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const briefs = await db.brief.findMany({
    where: { organizationId: active.organization.id },
    orderBy: { weekStart: "desc" },
    take: 12,
    select: { weekStart: true, content: true, feedback: true },
  });
  const rows = briefs.map((b) => {
    const c = b.content as unknown as BriefContent;
    const feedback = (b.feedback ?? []) as Array<{ up?: boolean; note?: string }>;
    const votes = feedback.filter((f) => f.up === false).length;
    const notes = feedback.filter((f) => f.up === false && (f.note ?? "").trim() !== "").map((f) => f.note!.slice(0, 200));
    return { week: b.weekStart, anomalies: c.anomalies ?? [], thumbsDown: votes, notes };
  });
  const totalVotes = rows.reduce((s, r) => s + r.thumbsDown, 0);
  const qualityScore = rows.length === 0 ? null : Math.max(0, 100 - totalVotes * 10);
  return NextResponse.json({ rows, qualityScore, digest: { briefs: rows.length, thumbsDown: totalVotes } });
}
