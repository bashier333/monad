import { db } from "@/lib/core/db";

export async function findDuplicateFile(organizationId: string, checksum: string, excludeRunId: string) {
  return db.importRun.findFirst({
    where: {
      organizationId,
      status: "COMPLETED",
      id: { not: excludeRunId },
      file: { checksum },
    },
    include: { file: true },
  });
}

export async function findOverlappingRuns(
  organizationId: string,
  dateMin: Date,
  dateMax: Date,
  excludeRunId: string,
) {
  return db.importRun.findMany({
    where: {
      organizationId,
      status: "COMPLETED",
      id: { not: excludeRunId },
      dateMin: { lte: dateMax },
      dateMax: { gte: dateMin },
    },
    include: { file: true },
  });
}
