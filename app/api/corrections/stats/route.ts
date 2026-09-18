import { NextResponse } from "next/server";
import { summarizeCorrections } from "@/lib/billing-events";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveOrg } from "@/lib/org";

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
