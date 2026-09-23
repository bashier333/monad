import { cookies } from "next/headers";
import { db } from "@/lib/core/db";

export async function getActiveOrg(userId: string) {
  try {
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
  } catch (e) {
    // A DB outage or missing table must degrade pages to their signed-out
    // fallbacks, never take down the whole render. The error is logged
    // server-side for operators (Vercel Runtime Logs).
    console.error(JSON.stringify({ level: "error", msg: "getActiveOrg failed", error: e instanceof Error ? e.message : String(e) }));
    return null;
  }
}
