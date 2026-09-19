import { cookies } from "next/headers";
import { db } from "@/lib/core/db";

export async function getActiveOrg(userId: string) {
  const cookieStore = await cookies();
  const pinned = cookieStore.get("activeOrgId")?.value;
  if (pinned) {
    const membership = await db.membership.findFirst({
      where: { userId, organizationId: pinned },
      include: { organization: true },
    });
    if (membership) return { membership, organization: membership.organization };
  }
  const membership = await db.membership.findFirst({
    where: { userId },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) return null;
  return { membership, organization: membership.organization };
}
