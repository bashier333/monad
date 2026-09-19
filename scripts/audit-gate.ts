// Audit gate (S-771/S-784): fails on NEW high/critical vulns.
// Known-accepted baseline (dated 2026-09-18, review monthly) lives below —
// majors with fixes get upgrade tickets, xlsx has no fix (mitigations in code).
import { execSync } from "child_process";

const BASELINE: Record<string, string> = {
  xlsx: "HIGH, no fix available — mitigated: extension allowlist, zip-magic check, sheet/cell caps, cellFormula off, prototype guard. Re-evaluate replacement quarterly.",
  next: "moderate, fix = major 16 — deferred: upgrade runbook + eval gate first.",
  "csv-parse": "moderate, fix = major 7 — deferred: breaking API, needs fixture re-proof.",
  prisma: "HIGH via @prisma/config/deepmerge-ts, fix = major 8 — deferred: migration risk, runbook first.",
  postcss: "HIGH, fix = next 16 — same ticket as next.",
};

function main() {
  const raw = execSync("npm audit --omit=dev --json", { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  const data = JSON.parse(raw) as {
    vulnerabilities: Record<string, { severity: string }>;
  };
  const fresh: string[] = [];
  for (const [name, v] of Object.entries(data.vulnerabilities)) {
    if ((v.severity === "high" || v.severity === "critical") && !BASELINE[name]) {
      fresh.push(`${name} (${v.severity})`);
    }
  }
  const known = Object.keys(BASELINE).filter((k) => data.vulnerabilities[k]);
  console.log(`audit-gate: ${fresh.length} new high/critical; ${known.length} known-accepted (${known.join(", ") || "none"})`);
  if (fresh.length > 0) {
    console.error(`NEW VULNERABILITIES BLOCK MERGE: ${fresh.join(", ")}`);
    process.exit(1);
  }
  console.log("audit-gate: ALL GREEN");
}

main();
