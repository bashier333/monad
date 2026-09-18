import { readFileSync } from "fs";
import path from "path";
import { applyMapping, detectColumns } from "@/lib/ingest/columns";
import { parseBuffer } from "@/lib/ingest/parse";
import { validateOptionsFor, validateRow } from "@/lib/ingest/validate";
import { describe, expect, it } from "vitest";

function load(name: string): Buffer {
  return readFileSync(path.join(process.cwd(), "fixtures", name));
}

function runPipeline(name: string, sourceType: string) {
  const { headers, rows } = parseBuffer(name, load(name));
  const { mapping } = detectColumns(headers);
  const mapped = applyMapping(headers, rows, mapping);
  const opts = validateOptionsFor(sourceType);
  const seen = new Set<string>();
  let ok = 0;
  const bad: number[] = [];
  for (const { rowNumber, record } of mapped) {
    if (validateRow(record, seen, opts).length === 0) ok++;
    else bad.push(rowNumber);
  }
  return { headers, total: mapped.length, ok, quarantined: bad.length, bad };
}

describe("fixture corpus (B-024)", () => {
  it("tms-week: 8 rows, 4 ok (dup + bad date + negative miles + missing revenue quarantined)", () => {
    const r = runPipeline("tms-week.csv", "tms");
    expect(r.total).toBe(8);
    expect(r.ok).toBe(4);
    expect(r.quarantined).toBe(4);
    expect(r.bad).toEqual([4, 5, 6, 7]);
  });

  it("fuel-week: 4 rows, 3 ok (missing amount quarantined)", () => {
    const r = runPipeline("fuel-week.csv", "fuel");
    expect(r.total).toBe(4);
    expect(r.ok).toBe(3);
    expect(r.quarantined).toBe(1);
  });

  it("broker-statement: 3 rows, all ok, load keys overlap the TMS file", () => {
    const r = runPipeline("broker-statement.csv", "broker");
    expect(r.total).toBe(3);
    expect(r.ok).toBe(3);
  });
});
