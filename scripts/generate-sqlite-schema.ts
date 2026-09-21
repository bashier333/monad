// Generates prisma/schema.sqlite.prisma from prisma/schema.prisma by
// swapping ONLY the datasource provider (postgresql -> sqlite) and pointing
// the client output at a separate directory. The postgres schema stays the
// single source of truth for models; this file is build output (gitignored).
// Run: npm run db:generate:sqlite
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const src = readFileSync(join(root, "prisma", "schema.prisma"), "utf8");

if (!src.includes('provider = "postgresql"')) {
  throw new Error("expected postgresql provider line in prisma/schema.prisma");
}

const out = src
  .replace('provider = "postgresql"', 'provider = "sqlite"')
  .replace(
    "generator client {\n  provider = \"prisma-client-js\"\n}",
    'generator client {\n  provider = "prisma-client-js"\n  output   = "../generated/sqlite-client"\n}'
  );

writeFileSync(join(root, "prisma", "schema.sqlite.prisma"), out);
console.log("wrote prisma/schema.sqlite.prisma (provider sqlite, output generated/sqlite-client)");
