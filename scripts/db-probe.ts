import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const tables = await db.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE 'Onto%'
    ORDER BY table_name`;
  console.log("ONTO-TABLES:", JSON.stringify(tables.map((t) => t.table_name)));
  const dupes = (await db.$queryRaw`
    SELECT COUNT(*)::int AS n FROM (
      SELECT "organizationId", "weekStart" FROM "Brief"
      GROUP BY "organizationId", "weekStart" HAVING COUNT(*) > 1
    ) d`) as Array<{ n: number }>;
  console.log("BRIEF-DUPES:", dupes[0]?.n ?? 0);
  await db.$disconnect();
}

main().catch((e) => {
  console.error("DB-PROBE-FAILED:", (e as Error).message);
  process.exit(1);
});
