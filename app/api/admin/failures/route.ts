import { NextResponse } from "next/server";
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

  const orgId = active.organization.id;
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [failedRuns, stuckRuns, pastDue, recentAccess] = await Promise.all([
    db.importRun.findMany({
      where: { organizationId: orgId, status: "FAILED", updatedAt: { gte: weekAgo } },
      select: { id: true, failureReason: true, updatedAt: true, file: { select: { filename: true } } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    db.importRun.count({ where: { organizationId: orgId, status: { in: ["PENDING", "PROCESSING"] } } }),
    db.subscription.findFirst({ where: { organizationId: orgId, status: "past_due" }, select: { statusChangedAt: true } }),
    db.accessLog.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { action: true, target: true, createdAt: true, userId: true },
    }),
  ]);

  return NextResponse.json({ failedRuns, stuckRuns, pastDue, recentAccess });
}
