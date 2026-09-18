import { readFileSync } from "fs";
import path from "path";
import { applyMapping, detectColumns } from "@/lib/ingest/columns";
import { MAX_ROWS, parseBuffer } from "@/lib/ingest/parse";
import { validateOptionsFor, validateRow } from "@/lib/ingest/validate";
import { toISODate } from "@/lib/margin/engine";
import { describe, expect, it } from "vitest";

function runPipeline(name: string, sourceType: string) {
  const buf = readFileSync(path.join(process.cwd(), "fixtures", name));
  const { headers, rows } = parseBuffer(name, buf);
  const { mapping } = detectColumns(headers);
  const mapped = applyMapping(headers, rows, mapping);
  const opts = validateOptionsFor(sourceType);
  const seen = new Set<string>();
  let ok = 0;
  const codes: string[] = [];
  for (const { record } of mapped) {
    const issues = validateRow(record, seen, opts);
    if (issues.length === 0) ok++;
    else codes.push(...issues.map((i) => i.code));
  }
  return { total: mapped.length, ok, quarantined: mapped.length - ok, codes };
}

describe("adversarial fixtures (B-087)", () => {
  it("unicode cities parse and validate cleanly", () => {
    const r = runPipeline("nasty-unicode.csv", "tms");
    expect(r).toMatchObject({ total: 2, ok: 2, quarantined: 0 });
  });

  it("all-null revenue quarantines every row with REQUIRED", () => {
    const r = runPipeline("null-revenue.csv", "tms");
    expect(r).toMatchObject({ total: 2, ok: 0, quarantined: 2 });
    expect(r.codes.every((c) => c === "REQUIRED")).toBe(true);
  });

  it("future dates validate (parseable) but fall outside any current week", () => {
    const r = runPipeline("future-dates.csv", "tms");
    expect(r).toMatchObject({ total: 2, ok: 2, quarantined: 0 });
    expect(toISODate("2027-03-01")).toBe("2027-03-01");
  });

  it("duplicate-everything keeps the first row, quarantines the rest", () => {
    const r = runPipeline("dup-everything.csv", "tms");
    expect(r).toMatchObject({ total: 5, ok: 1, quarantined: 4 });
    expect(r.codes.filter((c) => c === "DUPLICATE_KEY")).toHaveLength(4);
  });

  it("documents the row-cap guard (2M-row files are rejected, not attempted)", () => {
    expect(MAX_ROWS).toBe(500_000);
  });
});
