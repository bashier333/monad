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

  const [subs, meter] = await Promise.all([
    db.subscription.findMany({ select: { organizationId: true, tier: true, status: true, currentPeriodEnd: true, updatedAt: true } }),
    db.meterEvent.groupBy({ by: ["organizationId"], _sum: { qty: true } }),
  ]);
  const usage: Record<string, number> = {};
  for (const g of meter) usage[g.organizationId] = g._sum.qty ?? 0;

  const lines = ["org,tier,status,period_end,metered_events,updated"];
  for (const s of subs) {
    lines.push(
      [s.organizationId, s.tier, s.status, s.currentPeriodEnd?.toISOString().slice(0, 10) ?? "", String(usage[s.organizationId] ?? 0), s.updatedAt.toISOString().slice(0, 10)]
        .map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v))
        .join(","),
    );
  }
  return new NextResponse(lines.join("\n"), {
    headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=\"finance-export.csv\"" },
  });
}
