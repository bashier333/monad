// Bundle budget gate (R-555): fails over 150kB per page. Run after `npm run build`.
import { readFileSync, statSync, existsSync } from "fs";
import path from "path";

const BUDGET = 150 * 1024;
const nextDir = path.join(process.cwd(), ".next");

function pageSizes(): Array<{ page: string; bytes: number }> {
  const manifestPath = path.join(nextDir, "build-manifest.json");
  if (!existsSync(manifestPath)) {
    console.error("bundle-budget: no .next/build-manifest.json — run `npm run build` first. Failing: a silent pass hides regressions.");
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { pages: Record<string, string[]> };
  const usage = new Map<string, number>();
  const pageCount = Object.keys(manifest.pages).length;
  for (const files of Object.values(manifest.pages)) {
    for (const f of new Set(files.filter((x) => x.endsWith(".js")))) {
      usage.set(f, (usage.get(f) ?? 0) + 1);
    }
  }
  const sizeOf = (f: string): number => {
    const full = path.join(nextDir, f);
    return existsSync(full) ? statSync(full).size : 0;
  };
  let shared = 0;
  for (const [f, n] of usage) {
    if (n === pageCount) shared += sizeOf(f);
  }
  const out: Array<{ page: string; bytes: number }> = [];
  for (const [page, files] of Object.entries(manifest.pages)) {
    if (page === "/_app" || page === "/_error") continue;
    let bytes = shared;
    for (const f of files) {
      if (!f.endsWith(".js")) continue;
      if ((usage.get(f) ?? 0) === pageCount) continue;
      bytes += sizeOf(f);
    }
    out.push({ page, bytes });
  }
  return out;
}

const sizes = pageSizes();
let fail = false;
for (const s of sizes) {
  const ok = s.bytes <= BUDGET;
  if (!ok) fail = true;
  console.log(`${ok ? "✓" : "✗"} ${s.page}: ${Math.round(s.bytes / 1024)}kB (budget 150kB)`);
}
if (fail) {
  console.error("BUNDLE BUDGET EXCEEDED");
  process.exit(1);
}
console.log("bundle-budget: ALL GREEN");
