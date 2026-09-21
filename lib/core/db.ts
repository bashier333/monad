import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";

// Provider switch: a file: DATABASE_URL selects the SQLite client,
// anything else uses Postgres. This is how the portable exe runs
// zero-config (monad.env points at a local file) while web/staging keep
// Postgres. The sqlite client is generated on demand — see
// scripts/generate-sqlite-schema.ts + `npm run db:generate:sqlite`.
export function isSqliteUrl(url: string | undefined): boolean {
  return !!url && url.startsWith("file:");
}

type AnyClient = PrismaClient;

type SqliteClientModule = { PrismaClient: new (opts?: object) => AnyClient };

// Load the generated sqlite client with a REAL Node require rooted at the
// server's working directory. A bare `require(id)` must never be used here:
// webpack rewrites it inside Next server bundles, so it resolves relative
// to the compiled chunk instead of the filesystem and fails even when the
// files exist (this broke every fresh install — v1.1.1 fix). createRequire
// is a plain function call, so the bundler leaves it alone.
function realRequire(): NodeRequire {
  // A bare require() must never appear in this file: webpack rewrites every
  // syntactic require() inside Next server bundles (it then resolves relative
  // to the compiled chunk, not the filesystem), which broke every fresh
  // install. process.getBuiltinModule is a runtime method call the bundler
  // cannot rewrite, so the returned require is the real Node loader.
  const proc = process as unknown as {
    getBuiltinModule?: (id: string) => { createRequire: (base: string) => NodeRequire };
  };
  if (typeof proc.getBuiltinModule !== "function") {
    throw new Error("this Node runtime lacks process.getBuiltinModule — cannot load the sqlite client");
  }
  return proc.getBuiltinModule("node:module").createRequire(path.join(process.cwd(), "package.json"));
}

function loadSqliteClientModule(): { mod: SqliteClientModule; resolvedFrom: string } {
  const req = realRequire();
  const id = path.join(process.cwd(), "generated", "sqlite-client");
  try {
    return { mod: req(id) as SqliteClientModule, resolvedFrom: id };
  } catch (e) {
    throw new Error(
      `sqlite client not found at ${id} — run \`npm run db:generate:sqlite\` first. (${e instanceof Error ? e.message : String(e)})`
    );
  }
}

function loadSqliteClient(): AnyClient {
  // Loaded on demand (not imported) because the sqlite client only exists
  // after the opt-in `npm run db:generate:sqlite` step. electron/prepare.cjs
  // copies it into the standalone tree, so the packaged server finds it via
  // cwd — the same path in dev (`next start` runs with cwd = app root).
  const { mod } = loadSqliteClientModule();
  const url = process.env.DATABASE_URL;
  return new mod.PrismaClient(url ? { datasourceUrl: url } : {});
}

function createClient(): AnyClient {
  if (isSqliteUrl(process.env.DATABASE_URL)) {
    try {
      return loadSqliteClient();
    } catch (e) {
      throw new Error(
        `DATABASE_URL selects SQLite but the client failed to load. (${e instanceof Error ? e.message : String(e)})`
      );
    }
  }
  return new PrismaClient();
}

const globalForPrisma = globalThis as unknown as { prisma?: AnyClient };

export const db = (globalForPrisma.prisma ?? createClient()) as PrismaClient;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export function isSqliteProvider(): boolean {
  return isSqliteUrl(process.env.DATABASE_URL);
}

// Serializable transactions are a Postgres-only spelling. SQLite is
// single-writer with a busy timeout (see sqlite.ts pragmas), which gives the
// same OCC safety for our count-then-write patterns — so on SQLite we pass
// no isolation option instead of one the connector rejects.
export function txSerializable(): { isolationLevel?: (typeof Prisma.TransactionIsolationLevel)[keyof typeof Prisma.TransactionIsolationLevel] } {
  if (isSqliteProvider()) return {};
  return { isolationLevel: Prisma.TransactionIsolationLevel.Serializable };
}
