import { PrismaClient } from "@prisma/client";
import { deleteOrgData } from "../lib/core/org-data";

const RETENTION_DAYS = 90;
const execute = process.argv.includes("--execute");

const db = new PrismaClient();

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl || dbUrl.includes("localhost")) {
    console.log("retention-sweep: refusing to run without a staging/production DATABASE_URL.");
    process.exit(0);
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
  const expired = await db.subscription.findMany({
    where: { status: "canceled", statusChangedAt: { lt: cutoff } },
    select: { organizationId: true, statusChangedAt: true },
  });

  const abandonedCutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
  const abandoned = await db.importRun.findMany({
    where: { status: { in: ["FAILED", "CANCELLED"] }, updatedAt: { lt: abandonedCutoff } },
    select: { id: true, status: true, updatedAt: true },
  });

  if (expired.length === 0) {
    console.log("retention-sweep: nothing past 90-day retention.");
  }
  for (const e of expired) {
    if (!execute) {
      console.log(`WOULD PURGE org ${e.organizationId} (canceled ${e.statusChangedAt.toISOString()})`);
      continue;
    }
    await deleteOrgData(e.organizationId);
    console.log(`PURGED org ${e.organizationId}`);
  }
  for (const a of abandoned) {
    if (!execute) {
      console.log(`WOULD PURGE abandoned run ${a.id} (${a.status} since ${a.updatedAt.toISOString()})`);
      continue;
    }
    await db.importRun.delete({ where: { id: a.id } });
    console.log(`PURGED abandoned run ${a.id}`);
  }
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
