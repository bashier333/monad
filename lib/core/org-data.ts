import { db } from "@/lib/core/db";
import { deleteBytes } from "@/lib/core/storage";

export const EXPORT_SCHEMA_VERSION = 1 as const;

export const ORG_DATA_TABLES = [
  "brief",
  "standingRule",
  "correction",
  "answerShare",
  "placeAlias",
  "columnMapping",
  "importRun",
  "dataFile",
  "meterEvent",
  "accessLog",
  "pilotChecklist",
  "notification",
  "eventLog",
  "webhookEndpoint",
  "apiKey",
  "alertRule",
  "workflowRun",
  "workflowPlaybook",
  "orgDeletion",
] as const;

export async function deleteOrgData(organizationId: string): Promise<void> {
  const files = await db.dataFile.findMany({ where: { organizationId }, select: { storageKey: true } });
  for (const f of files) {
    try {
      await deleteBytes(f.storageKey);
    } catch {
      // storage already gone — DB row still deletes below
    }
  }
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
  await db.notification.deleteMany({ where: { organizationId } });
  await db.eventLog.deleteMany({ where: { orgId: organizationId } });
  await db.webhookEndpoint.deleteMany({ where: { orgId: organizationId } });
  await db.apiKey.deleteMany({ where: { orgId: organizationId } });
  await db.alertRule.deleteMany({ where: { orgId: organizationId } });
  const playbooks = await db.workflowPlaybook.findMany({ where: { orgId: organizationId }, select: { id: true } });
  await db.workflowRun.deleteMany({ where: { playbookId: { in: playbooks.map((p) => p.id) } } });
  await db.workflowPlaybook.deleteMany({ where: { orgId: organizationId } });
  await db.orgDeletion.deleteMany({ where: { orgId: organizationId } });
}
