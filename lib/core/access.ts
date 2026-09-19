import { db } from "@/lib/core/db";
import { logger } from "@/lib/core/logger";

export async function logAccess(
  organizationId: string,
  userId: string,
  action: string,
  target: string,
  requestId?: string,
): Promise<void> {
  try {
    await db.accessLog.create({ data: { organizationId, userId, action, target } });
  } catch (e) {
    logger.error("access log write failed", { organizationId, action, requestId: requestId ?? "none", error: String(e) });
  }
}
