import { db } from "@/lib/core/db";

export async function deleteOrgData(organizationId: string): Promise<void> {
  await db.brief.deleteMany({ where: { organizationId } });
  await db.standingRule.deleteMany({ where: { organizationId } });
  await db.correction.deleteMany({ where: { organizationId } });
  await db.answerShare.deleteMany({ where: { organizationId } });
  await db.placeAlias.deleteMany({ where: { organizationId } });
  await db.columnMapping.deleteMany({ where: { organizationId } });
  await db.importRun.deleteMany({ where: { organizationId } });
  await db.dataFile.deleteMany({ where: { organizationId } });
  await db.meterEvent.deleteMany({ where: { organizationId } });
  await db.accessLog.deleteMany({ where: { organizationId } });
  await db.pilotChecklist.deleteMany({ where: { organizationId } });
}
