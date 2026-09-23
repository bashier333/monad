// Vercel build step: apply pending Prisma migrations before `next build`.
// Runs ONLY on Vercel (process.env.VERCEL === "1") so local dev and the
// portable exe (which may point at SQLite or have no database at all) are
// untouched. Without this, schema changes ship in code but never reach the
// hosted database — every query against a missing table crashes its page.
const { spawnSync } = require("node:child_process");

if (process.env.VERCEL !== "1") {
  console.log("[db-migrate] not on Vercel, skipping.");
  process.exit(0);
}

const candidates = [
  process.env.DATABASE_URL,
  process.env.POSTGRES_URL_NON_POOLING,
  process.env.POSTGRES_PRISMA_URL,
].filter((u) => typeof u === "string" && u.startsWith("postgres"));

if (candidates.length === 0) {
  console.warn("[db-migrate] no Postgres URL at build time, skipping (runtime health will report).");
  process.exit(0);
}

let lastError = null;
for (const url of candidates) {
  console.log("[db-migrate] prisma migrate deploy...");
  const res = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, DATABASE_URL: url },
  });
  if (res.status === 0) process.exit(0);
  lastError = `exit ${res.status}`;
}
console.error(`[db-migrate] all migrate attempts failed (last: ${lastError})`);
process.exit(1);
