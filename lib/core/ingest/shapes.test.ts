import { readFileSync, readdirSync } from "fs";
import path from "path";
import { applyMapping, detectColumns } from "@/lib/core/ingest/columns";
import { parseBuffer } from "@/lib/core/ingest/parse";
import { validateOptionsFor, validateRow } from "@/lib/core/ingest/validate";
import { describe, expect, it } from "vitest";

const SHAPES = [
  "reefer.csv",
  "flatbed.csv",
  "tanker.csv",
  "intermodal.csv",
  "team-driver.csv",
  "owner-op.csv",
  "short-haul.csv",
  "cross-border.csv",
  "hazmat.csv",
  "ltl-multistop.csv",
];

const REVENUELESS = new Set(["owner-op.csv"]);

describe("shape fixtures (W3)", () => {
  it("all 36 fixture files exist (20 freight + 16 agency X4)", () => {
    const files = readdirSync(path.join(process.cwd(), "fixtures")).filter((f) => f.endsWith(".csv"));
    const expected = [
      "agency-approvals.csv",
      "agency-assets.csv",
      "agency-design.csv",
      "agency-dups.csv",
      "agency-feedback.csv",
      "agency-footers.csv",
      "agency-future.csv",
      "agency-invoices.csv",
      "agency-messy.csv",
      "agency-null-hours.csv",
      "agency-projects.csv",
      "agency-rates.csv",
      "agency-revisions.csv",
      "agency-time.csv",
      "agency-unicode.csv",
      "agency-video-week.csv",
    ];
    for (const f of expected) expect(files, f).toContain(f);
    expect(files.length).toBeGreaterThanOrEqual(36);
  });
  for (const name of SHAPES) {
    it(`${name} parses, maps core fields, and validates`, () => {
      const buf = readFileSync(path.join(process.cwd(), "fixtures", name));
      const { headers, rows } = parseBuffer(name, buf);
      expect(rows.length).toBeGreaterThan(0);
      const { mapping } = detectColumns(headers);
      expect(mapping.loadId).toBeDefined();
      expect(mapping.date).toBeDefined();
      if (REVENUELESS.has(name)) {
        expect(mapping.revenue).toBeUndefined();
        return;
      }
      expect(mapping.revenue).toBeDefined();
      const mapped = applyMapping(headers, rows, mapping);
      const opts = validateOptionsFor("tms");
      const seen = new Set<string>();
      const ok = mapped.filter(({ record }) => validateRow(record, seen, opts).length === 0).length;
      expect(ok).toBeGreaterThan(0);
    });
  }
});
