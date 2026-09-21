import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { db, isSqliteProvider } from "@/lib/core/db";

// SQLite boot for the portable exe: ensure the directory exists, set
// single-writer-safe pragmas, and refuse to boot the model on an empty file
// (tables come from the packaged template DB — see electron/prepare.cjs —
// or `npm run db:push:sqlite` in dev). Static PRAGMA strings only; no
// interpolated raw SQL anywhere in this codebase.
function sqlitePath(): string | null {
  const url = process.env.DATABASE_URL ?? "";
  if (!isSqliteProvider()) return null;
  const file = url.startsWith("file:") ? url.slice("file:".length) : url;
  return isAbsolute(file) ? file : resolve(process.cwd(), file);
}

export function sqliteFilePath(): string | null {
  return sqlitePath();
}

export async function ensureSqlite(): Promise<{ ok: true } | { ok: false; error: string }> {
  const file = sqlitePath();
  if (!file) return { ok: true };
  try {
    mkdirSync(dirname(file), { recursive: true });
  } catch (e) {
    return { ok: false, error: `cannot create sqlite dir: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!existsSync(file)) {
    // Fresh portable install: seed from the packaged template (empty tables)
    // so first boot has schema but nobody else's data.
    const template = resolve(process.cwd(), "monad.template.db");
    if (existsSync(template)) {
      try {
        copyFileSync(template, file);
      } catch (e) {
        return { ok: false, error: `cannot seed sqlite from template: ${e instanceof Error ? e.message : String(e)}` };
      }
    }
  }
  try {
    // Static pragmas: WAL + NORMAL sync + busy timeout + FK enforcement.
    // WAL is what makes concurrent readers + single writer safe on desktop.
    // journal_mode returns its value, so it goes through $queryRaw — and we
    // assert WAL actually engaged (read-only media or exotic filesystems can
    // silently refuse it, which would void our concurrency story).
    const mode = (await db.$queryRaw`PRAGMA journal_mode=WAL`) as Array<{ journal_mode?: string }>;
    if ((mode[0]?.journal_mode ?? "").toLowerCase() !== "wal") {
      return { ok: false, error: "sqlite refused WAL journal mode" };
    }
    await db.$executeRaw`PRAGMA synchronous=NORMAL`;
    await db.$queryRaw`PRAGMA busy_timeout=5000`;
    await db.$executeRaw`PRAGMA foreign_keys=ON`;
    const tables = (await db.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' AND name='Organization'`) as Array<{
      name: string;
    }>;
    if (tables.length === 0) {
      return {
        ok: false,
        error: `sqlite file has no tables: ${file}. Package the template DB (npm run dist:exe) or run npm run db:push:sqlite with this DATABASE_URL.`,
      };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `sqlite setup failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}
