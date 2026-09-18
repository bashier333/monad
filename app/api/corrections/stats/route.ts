import { NextResponse } from "next/server";
import { summarizeCorrections } from "@/lib/core/billing-events";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });

  const grouped = await db.correction.groupBy({
    by: ["status"],
    where: { organizationId: active.organization.id },
    _count: true,
  });
  const rules = await db.standingRule.count({
    where: { organizationId: active.organization.id, active: true },
  });
  return NextResponse.json({ ...summarizeCorrections(grouped.map((g) => ({ status: g.status, _count: g._count })), rules), activeRules: rules });
}
