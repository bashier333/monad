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
  const playbooks = await db.workflowPlaybook.findMany({ where: { orgId: organizationId }, select: { id: true } });
  const playbookIds = playbooks.map((p) => p.id);
  await db.$transaction([
    db.workflowRun.deleteMany({ where: { playbookId: { in: playbookIds } } }),
    db.workflowPlaybook.deleteMany({ where: { orgId: organizationId } }),
    db.brief.deleteMany({ where: { organizationId } }),
    db.standingRule.deleteMany({ where: { organizationId } }),
    db.correction.deleteMany({ where: { organizationId } }),
    db.answerShare.deleteMany({ where: { organizationId } }),
    db.placeAlias.deleteMany({ where: { organizationId } }),
    db.columnMapping.deleteMany({ where: { organizationId } }),
    db.importRun.deleteMany({ where: { organizationId } }),
    db.dataFile.deleteMany({ where: { organizationId } }),
    db.meterEvent.deleteMany({ where: { organizationId } }),
    db.accessLog.deleteMany({ where: { organizationId } }),
    db.pilotChecklist.deleteMany({ where: { organizationId } }),
    db.notification.deleteMany({ where: { organizationId } }),
    db.eventLog.deleteMany({ where: { orgId: organizationId } }),
    db.webhookEndpoint.deleteMany({ where: { orgId: organizationId } }),
    db.apiKey.deleteMany({ where: { orgId: organizationId } }),
    db.alertRule.deleteMany({ where: { orgId: organizationId } }),
    db.orgDeletion.deleteMany({ where: { orgId: organizationId } }),
  ]);
}
