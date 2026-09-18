import { NextResponse } from "next/server";
import type { BriefContent } from "@/lib/brief/build";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveOrg } from "@/lib/org";
import { requireCan } from "@/lib/roles";

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
    const votes = ((b.feedback ?? []) as Array<{ up?: boolean }>).filter((f) => f.up === false).length;
    return { week: b.weekStart, anomalies: c.anomalies ?? [], thumbsDown: votes };
  });
  return NextResponse.json({ rows });
}
