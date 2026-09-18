import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { FREE_LIMITS, getSubscription, monthlyUploads, toSubState } from "@/lib/core/billing";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  const grouped = await db.meterEvent.groupBy({
    by: ["kind"],
    where: { organizationId: active.organization.id, createdAt: { gte: since } },
    _sum: { qty: true },
  });
  const usage: Record<string, number> = {};
  for (const g of grouped) usage[g.kind] = g._sum.qty ?? 0;
  const alerts: string[] = [];
  const sub = toSubState(await getSubscription(active.organization.id));
  if (sub.tier === "free") {
    const uploads = await monthlyUploads(active.organization.id);
    for (const pct of [50, 80, 100]) {
      if (uploads >= Math.floor((FREE_LIMITS.uploadsPerMonth * pct) / 100)) {
        alerts.push(`uploads at ${pct}% of free monthly limit (${uploads}/${FREE_LIMITS.uploadsPerMonth})`);
      }
    }
  }
  return NextResponse.json({ usage, windowDays: 30, alerts });
}
