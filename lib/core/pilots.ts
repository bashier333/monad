import { db } from "@/lib/core/db";

export async function ensureChecklist(organizationId: string) {
  await db.pilotChecklist.upsert({
    where: { organizationId },
    update: {},
    create: { organizationId },
  });
}

export async function stampFirstAnswer(organizationId: string): Promise<void> {
  await ensureChecklist(organizationId);
  await db.pilotChecklist.updateMany({
    where: { organizationId, firstAnswerAt: null },
    data: { firstAnswerAt: new Date() },
  });
}

export async function stampFirstCorrection(organizationId: string): Promise<void> {
  await ensureChecklist(organizationId);
  await db.pilotChecklist.updateMany({
    where: { organizationId, firstCorrectionAt: null },
    data: { firstCorrectionAt: new Date() },
  });
}

export async function stampConversion(organizationId: string): Promise<void> {
  await ensureChecklist(organizationId);
  await db.pilotChecklist.updateMany({
    where: { organizationId, convertedAt: null },
    data: { convertedAt: new Date() },
  });
}
