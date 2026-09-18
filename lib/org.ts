import { db } from "@/lib/db";

export async function getActiveOrg(userId: string) {
  const membership = await db.membership.findFirst({
    where: { userId },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) return null;
  return { membership, organization: membership.organization };
}
