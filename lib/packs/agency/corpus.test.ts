import { readFileSync } from "fs";
import path from "path";
import { applyMapping, detectColumns } from "@/lib/core/ingest/columns";
import { parseBuffer } from "@/lib/core/ingest/parse";
import { AGENCY_ALIASES, AGENCY_FIELDS } from "@/lib/packs/agency/fields";
import { validateAgencyRow } from "@/lib/packs/agency/validate";
import { describe, expect, it } from "vitest";

function load(name: string): Buffer {
  return readFileSync(path.join(process.cwd(), "fixtures", name));
}

function runPipeline(name: string, sourceType: string) {
  const { headers, rows } = parseBuffer(name, load(name));
  const { mapping } = detectColumns(headers, AGENCY_FIELDS, AGENCY_ALIASES);
  const mapped = applyMapping(headers, rows, mapping, AGENCY_FIELDS);
  const opts = sourceType;
  const seen = new Set<string>();
  let ok = 0;
  const codes: string[] = [];
  for (const { record } of mapped) {
    const issues = validateAgencyRow(record, seen, opts);
    if (issues.length === 0) ok++;
    else codes.push(...issues.map((i) => i.code));
  }
  return { headers, total: mapped.length, ok, quarantined: mapped.length - ok, codes, mapping };
}

describe("agency fixture corpus (X4)", () => {
  it("time fixture: 3 rows, all valid, project/hours mapped", () => {
    const r = runPipeline("agency-time.csv", "time");
    expect(r.total).toBe(3);
    expect(r.ok).toBe(3);
    expect(r.mapping.project).toBeDefined();
    expect(r.mapping.hours).toBeDefined();
  });

  it("messy fixture: missing project, bad date, negative hours quarantined", () => {
    const r = runPipeline("agency-messy.csv", "time");
    expect(r.total).toBe(4);
    expect(r.ok).toBe(1);
    expect(r.codes).toContain("REQUIRED");
    expect(r.codes).toContain("INVALID_DATE");
    expect(r.codes).toContain("NEGATIVE_VALUE");
  });

  it("unicode fixture parses cleanly", () => {
    const r = runPipeline("agency-unicode.csv", "time");
    expect(r.total).toBe(2);
    expect(r.ok).toBe(2);
  });

  it("revision/approval/invoice/project fixtures parse with headers", () => {
    for (const [f, type] of [
      ["agency-revisions.csv", "revision"],
      ["agency-approvals.csv", "approval"],
      ["agency-invoices.csv", "invoice"],
      ["agency-projects.csv", "project"],
      ["agency-rates.csv", "rate"],
    ] as const) {
      const { headers, rows } = parseBuffer(f, load(f));
      expect(rows.length, f).toBeGreaterThan(0);
      expect(headers.length, f).toBeGreaterThanOrEqual(2);
      void type;
    }
  });
});
