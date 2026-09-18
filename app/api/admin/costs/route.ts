import { NextResponse } from "next/server";
import { cacheStats } from "@/lib/core/cache";
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
  const [bytes, meter, byPack, briefs, shares, users] = await Promise.all([
    db.dataFile.aggregate({ where: { organizationId: orgId }, _sum: { bytes: true } }),
    db.meterEvent.groupBy({ by: ["kind"], where: { organizationId: orgId }, _sum: { qty: true } }),
    db.meterEvent.groupBy({ by: ["pack", "kind"], where: { organizationId: orgId }, _sum: { qty: true } }),
    db.brief.groupBy({ by: ["pack"], where: { organizationId: orgId }, _count: { id: true } }),
    db.answerShare.groupBy({ by: ["pack"], where: { organizationId: orgId }, _count: { id: true } }),
    db.membership.count({ where: { organizationId: orgId } }),
  ]);
  const usage: Record<string, number> = {};
  for (const g of meter) usage[g.kind] = g._sum.qty ?? 0;
  const usageByPack: Record<string, Record<string, number>> = {};
  for (const g of byPack) {
    usageByPack[g.pack] = usageByPack[g.pack] ?? {};
    usageByPack[g.pack][g.kind] = g._sum.qty ?? 0;
  }

  return NextResponse.json({
    llmUsd: 0,
    llmNote: "No LLM calls in the product path yet (deterministic matcher + template briefs). Revisit when agent features ship.",
    storageBytes: bytes._sum.bytes ?? 0,
    usage,
    usageByPack,
    briefsByPack: Object.fromEntries(briefs.map((b) => [b.pack, b._count.id])),
    sharesByPack: Object.fromEntries(shares.map((s) => [s.pack, s._count.id])),
    seats: users,
    cache: cacheStats(),
    grossMarginNote: "COGS is storage + compute only — margin stays >80% until LLM features ship.",
  });
}
