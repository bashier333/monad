// One-command release: `npx tsx scripts/release.ts 1.4.0 [--notes="a;b;c"] [--date=YYYY-MM-DD]`
//
// Propagates the new version EVERYWHERE so users get it when finished:
//   package.json, lib/core/version.ts (single source), app/changelog ENTRIES,
//   CHANGELOG.md, package-lock.json (via npm install --package-lock-only).
// Everything else (health, status, landing, download, /api/desktop, exe feed)
// reads the single source at runtime — no per-surface edits needed.
//
// After this script: run gates, `npm run dist:exe`, deploy the site, commit.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

function fail(msg: string): never {
  console.error(`release: ${msg}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const next = args.find((a) => !a.startsWith("--"));
if (!next || !SEMVER.test(next)) fail("usage: npx tsx scripts/release.ts <x.y.z> [--notes=\"a;b;c\"] [--date=YYYY-MM-DD]");
const dateArg = args.find((a) => a.startsWith("--date="))?.slice("--date=".length);
const date = dateArg ?? new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail("--date must be YYYY-MM-DD");
const notesArg = args.find((a) => a.startsWith("--notes="))?.slice("--notes=".length);
const notes = (notesArg ?? "").split(";").map((s) => s.trim()).filter(Boolean);

const pkgPath = join(ROOT, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
const cur = pkg.version;
const cmp = (a: string, b: string) =>
  a.split(".").map(Number).reduce((acc, n, i) => acc || (n - (b.split(".").map(Number)[i] as number)), 0);
if (cmp(next!, cur) <= 0) fail(`new version ${next} must be greater than current ${cur}`);

// 1. package.json
pkg.version = next!;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

// 2. single source
const verPath = join(ROOT, "lib", "core", "version.ts");
let ver = readFileSync(verPath, "utf8");
if (!ver.includes(`"${cur}"`)) fail(`version.ts does not contain current ${cur} — hand-edited? fix first`);
ver = ver.replace(`"${cur}"`, `"${next}"`);
writeFileSync(verPath, ver);

// 3. changelog page ENTRIES (content notes; version+date always)
const clPage = join(ROOT, "app", "(marketing)", "changelog", "page.tsx");
let page = readFileSync(clPage, "utf8");
const entry =
  `  {\n    version: "${next}",\n    date: "${date}",\n` +
  (notes.length > 0
    ? `    notes: [\n${notes.map((n) => `      "${n.replace(/"/g, "'")}",\n`).join("")}    ],\n`
    : `    notes: ["See CHANGELOG.md for the full notes."],\n`) +
  `  },\n`;
if (!page.includes(`version: "${cur}"`)) fail("changelog page missing current version entry");
const eol = page.includes("\r\n") ? "\r\n" : "\n";
const marker = "const ENTRIES: Array<{ version: string; date: string; notes: string[] }> = [";
if (!page.includes(marker)) fail("changelog page ENTRIES marker not found");
const entryLines = entry.split("\n").join(eol);
page = page.replace(marker, marker + eol + entryLines.replace(new RegExp(`${eol}$`), ""));
writeFileSync(clPage, page);

// 4. CHANGELOG.md section
const clPath = join(ROOT, "CHANGELOG.md");
let cl = readFileSync(clPath, "utf8");
const section =
  `## [${next}] - ${date}\n\n` +
  (notes.length > 0 ? notes.map((n) => `- ${n}\n`).join("") : `- See the changelog page for notes.\n`) +
  `\n---\n\n`;
if (!cl.includes(`## [${cur}]`)) fail("CHANGELOG.md missing current version section");
// Insert before the first existing version section.
const firstSection = cl.indexOf("## [");
cl = cl.slice(0, firstSection) + section + cl.slice(firstSection);
writeFileSync(clPath, cl);

// 5. lockfile sync (version only, no dep upgrades)
execSync("npm install --package-lock-only --ignore-scripts", { cwd: ROOT, stdio: "inherit" });

console.log(`release: ${cur} -> ${next} propagated everywhere.`);
console.log("release: next — 1) npm run typecheck && npm run lint && npm run test");
console.log("release: next — 2) npm run dist:exe (SQLITE_TEMPLATE=1) so the feed serves the new installer");
console.log("release: next — 3) deploy the site (health + feed + download carry the new version)");
console.log("release: next — 4) git add -A && git commit -m \"feat: v" + next + " — <headline>\"");
