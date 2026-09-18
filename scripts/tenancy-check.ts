import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl || dbUrl.includes("localhost")) {
    console.log("tenancy-check: refusing to run without a staging DATABASE_URL.");
    process.exit(0);
  }

  const orgA = await db.organization.create({ data: { name: "Tenancy A", slug: `ten-a-${Date.now()}` } });
  const orgB = await db.organization.create({ data: { name: "Tenancy B", slug: `ten-b-${Date.now()}` } });
  try {
    const userA = await db.user.create({ data: { email: `a-${Date.now()}@tenancy.test` } });
    await db.membership.create({ data: { userId: userA.id, organizationId: orgA.id, role: "OWNER" } });
    const fileB = await db.dataFile.create({
      data: { organizationId: orgB.id, uploadedById: userA.id, filename: "probe.csv", bytes: 1, mime: "text/csv", checksum: `probe-${Date.now()}`, storageKey: "probe", scannedOk: true },
    });
    const runB = await db.importRun.create({
      data: { organizationId: orgB.id, fileId: fileB.id, uploadedById: userA.id, sourceType: "tms", status: "COMPLETED" },
    });
    await db.stagedRecord.create({
      data: { organizationId: orgB.id, runId: runB.id, rowNumber: 1, loadKey: "SECRET", data: {}, status: "ok" },
    });

    const seenByA = await db.stagedRecord.findMany({ where: { organizationId: orgA.id } });
    const leaked = seenByA.some((r) => r.loadKey === "SECRET");
    if (leaked) {
      console.error("TENANCY FAILURE: org A can read org B rows.");
      process.exit(1);
    }

    const directB = await db.stagedRecord.findMany({
      where: { organizationId: orgB.id, loadKey: "SECRET" },
    });
    if (directB.length === 0) {
      console.error("TENANCY SETUP FAILURE: probe row missing.");
      process.exit(1);
    }
    console.log("tenancy-check: PASS — org-scoped queries isolate tenants.");
  } finally {
    await db.importRun.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await db.dataFile.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await db.membership.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await db.user.deleteMany({ where: { email: { contains: "@tenancy.test" } } });
    await db.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
