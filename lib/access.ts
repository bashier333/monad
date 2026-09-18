import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function logAccess(
  organizationId: string,
  userId: string,
  action: string,
  target: string,
): Promise<void> {
  try {
    await db.accessLog.create({ data: { organizationId, userId, action, target } });
  } catch (e) {
    logger.error("access log write failed", { organizationId, action, error: String(e) });
  }
}
