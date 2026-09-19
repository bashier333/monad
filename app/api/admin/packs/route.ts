import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { pqlScore } from "@/lib/core/growth";

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
  const [usage, corrections, briefs, shares, firstAnswers] = await Promise.all([
    db.meterEvent.groupBy({ by: ["pack", "kind"], where: { organizationId: orgId }, _sum: { qty: true } }),
    db.correction.groupBy({ by: ["status"], where: { organizationId: orgId }, _count: true }),
    db.brief.groupBy({ by: ["pack"], where: { organizationId: orgId }, _count: { id: true } }),
    db.answerShare.groupBy({ by: ["pack"], where: { organizationId: orgId }, _count: { id: true } }),
    db.meterEvent.groupBy({ by: ["pack"], where: { organizationId: orgId, kind: "answer_view" }, _min: { createdAt: true } }),
  ]);

  const usageByPack: Record<string, Record<string, number>> = {};
  for (const g of usage) {
    usageByPack[g.pack] = usageByPack[g.pack] ?? {};
    usageByPack[g.pack][g.kind] = g._sum.qty ?? 0;
  }
  const orgCreated = active.organization.createdAt.toISOString();
  const packs: Record<string, unknown> = {};
  for (const pack of ["freight", "agency"]) {
    const u = usageByPack[pack] ?? {};
    const answers = u["answer_view"] ?? 0;
    const uploads = u["upload"] ?? 0;
    const first = firstAnswers.find((f) => f.pack === pack)?._min.createdAt ?? null;
    packs[pack] = {
      usage: u,
      corrections: corrections.reduce((s, c) => s + c._count, 0),
      briefs: briefs.find((b) => b.pack === pack)?._count.id ?? 0,
      shares: shares.find((s) => s.pack === pack)?._count.id ?? 0,
      firstAnswerAt: first,
      pql: pqlScore({
        answers,
        uploads,
        corrections: corrections.reduce((s, c) => s + c._count, 0),
        daysSinceFirstAnswer: first ? Math.max(0, Math.round((Date.now() - new Date(first).getTime()) / 86_400_000)) : null,
      }),
      orgCreated,
    };
  }
  return NextResponse.json({ packs });
}
