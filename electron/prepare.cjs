// Pre-package step: make .next/standalone self-contained for the exe.
// - copies .next/static and public/ into the standalone tree
// - removes any baked-in .env files so the exe uses runtime env only
//   (shipping a .env would leak DATABASE_URL / AUTH_SECRET into the binary)
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

copyDir(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"));
copyDir(path.join(root, "public"), path.join(standalone, "public"));

for (const f of [".env", ".env.local", ".env.production", ".env.production.local"]) {
  const p = path.join(standalone, f);
  if (fs.existsSync(p)) {
    fs.rmSync(p);
    console.log(`prepare: removed baked-in ${f}`);
  }
}

// Template SQLite DB for first boot: if the packager opted into a local
// file database (SQLITE_TEMPLATE=1), push the schema into a scratch file and
// ship it as monad.template.db inside the standalone tree. At runtime the
// server copies it to the user's DATABASE_URL path when no database exists
// yet — so a fresh install boots with empty tables, never with someone
// else's data. (The template is built under var/, never next to node.)
if (process.env.SQLITE_TEMPLATE) {
  const { execSync } = require("node:child_process");
  const os = require("node:os");
  const templateDb = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "monad-template-")), "template.db");
  try {
    execSync(`npx prisma db push --schema=prisma/schema.sqlite.prisma --accept-data-loss --skip-generate`, {
      cwd: root,
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: `file:${templateDb}` },
    });
    fs.copyFileSync(templateDb, path.join(standalone, "monad.template.db"));
    console.log("prepare: packaged sqlite template DB");
  } catch (e) {
    console.log(`prepare: sqlite template skipped (${e instanceof Error ? e.message : String(e)})`);
  } finally {
    try {
      fs.rmSync(path.dirname(templateDb), { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
}

// Private-testing AI key: every download ships the operator's NVIDIA key so
// the exe works out of the box with no setup. ONLY NVIDIA_* lines are
// extracted from the local (gitignored, never committed) monad.env —
// AUTH_SECRET, DATABASE_URL, resend keys and everything else stay out of
// the installer. Anyone holding the exe can read this key: private builds
// only, never a public release.
{
  const src = path.join(root, "monad.env");
  const dest = path.join(standalone, "monad.env.shipped");
  try {
    const kept = fs
      .readFileSync(src, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^NVIDIA_[A-Z_]+=/i.test(l));
    if (kept.length > 0) {
      fs.writeFileSync(dest, `# Shipped AI key for private testing builds. Do not publish this installer.\n${kept.join("\n")}\n`);
      console.log(`prepare: packaged AI key (${kept.length} NVIDIA_* lines, nothing else)`);
    } else {
      try {
        fs.rmSync(dest, { force: true });
      } catch {
        /* already absent */
      }
      console.log("prepare: no NVIDIA_* lines in monad.env — exe ships without AI key");
    }
  } catch {
    console.log("prepare: monad.env unreadable — exe ships without AI key");
  }
}

// Generated SQLite Prisma client: db.ts requires it from a standalone-
// relative path at runtime, so it must physically live inside the
// standalone tree (Next's file tracing does not follow that require).
if (fs.existsSync(path.join(root, "generated", "sqlite-client"))) {
  copyDir(path.join(root, "generated", "sqlite-client"), path.join(standalone, "generated", "sqlite-client"));
  console.log("prepare: packaged sqlite client");
} else {
  console.log("prepare: sqlite client absent (run npm run db:generate:sqlite to include file: mode)");
}
console.log("prepare: standalone ready for packaging");
