import { db } from "@/lib/core/db";

export async function notify(
  organizationId: string,
  userId: string,
  kind: string,
  title: string,
  href = "",
): Promise<void> {
  await db.notification.create({ data: { organizationId, userId, kind, title, href } });
}

export async function notifyOrg(
  organizationId: string,
  kind: string,
  title: string,
  href = "",
  excludeUserId?: string,
): Promise<void> {
  const members = await db.membership.findMany({
    where: { organizationId },
    select: { userId: true },
  });
  const targets = members.map((m) => m.userId).filter((id) => id !== excludeUserId);
  if (targets.length === 0) return;
  await db.notification.createMany({
    data: targets.map((userId) => ({ organizationId, userId, kind, title, href })),
  });
}
