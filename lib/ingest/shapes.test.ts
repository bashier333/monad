import { readFileSync, readdirSync } from "fs";
import path from "path";
import { applyMapping, detectColumns } from "@/lib/ingest/columns";
import { parseBuffer } from "@/lib/ingest/parse";
import { validateOptionsFor, validateRow } from "@/lib/ingest/validate";
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
  it("all 20 fixture files exist", () => {
    const files = readdirSync(path.join(process.cwd(), "fixtures")).filter((f) => f.endsWith(".csv"));
    expect(files.length).toBe(20);
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
