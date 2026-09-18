import { parseBuffer } from "@/lib/core/ingest/parse";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

describe("parseBuffer", () => {
  it("parses csv with ragged rows", () => {
    const t = parseBuffer("a.csv", Buffer.from("h1,h2\n1,2,3\n4\n"));
    expect(t.headers).toEqual(["h1", "h2"]);
    expect(t.rows).toHaveLength(2);
  });

  it("parses a generated xlsx workbook", () => {
    const wb = XLSX.utils.book_new();
    wb.SheetNames.push("S");
    wb.Sheets["S"] = XLSX.utils.aoa_to_sheet([["LoadID", "Revenue"], ["1", "100"]]);
    const buf = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer);
    const t = parseBuffer("a.xlsx", buf);
    expect(t.headers).toEqual(["LoadID", "Revenue"]);
    expect(t.rows).toEqual([["1", "100"]]);
  });

  it("returns empty for a sheet with no data", () => {
    const wb = XLSX.utils.book_new();
    wb.SheetNames.push("S");
    wb.Sheets["S"] = XLSX.utils.aoa_to_sheet([]);
    const buf = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer);
    expect(parseBuffer("empty.xlsx", buf)).toEqual({ headers: [], rows: [], skipped: [], encoding: "xlsx" });
  });
});
