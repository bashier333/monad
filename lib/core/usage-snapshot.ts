import { db } from "@/lib/core/db";
import { pqlScore, type UsageSnapshot } from "@/lib/core/growth";

// Server-only usage snapshot for the PQL strip: metered answers/uploads
// plus correction count and days since the first answer. New file (not in
// growth.ts) so the pure scoring functions stay dependency-free for tests.
export async function usageSnapshot(organizationId: string): Promise<UsageSnapshot> {
  const [answers, uploads, corrections, first] = await Promise.all([
    db.meterEvent.aggregate({ where: { organizationId, kind: "answer_view" }, _sum: { qty: true } }),
    db.meterEvent.aggregate({ where: { organizationId, kind: "upload" }, _sum: { qty: true } }),
    db.correction.count({ where: { organizationId } }),
    db.meterEvent.findFirst({ where: { organizationId, kind: "answer_view" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);
  const daysSinceFirstAnswer = first
    ? Math.max(0, Math.floor((Date.now() - first.createdAt.getTime()) / 86_400_000))
    : null;
  return {
    answers: answers._sum.qty ?? 0,
    uploads: uploads._sum.qty ?? 0,
    corrections,
    daysSinceFirstAnswer,
  };
}

export async function pqlForOrg(organizationId: string) {
  return pqlScore(await usageSnapshot(organizationId));
}
