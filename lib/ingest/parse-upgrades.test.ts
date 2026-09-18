import { assertRowCap, MAX_ROWS, parseBuffer } from "@/lib/ingest/parse";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

describe("parse upgrades (W4)", () => {
  it("strips a UTF-8 BOM", () => {
    const t = parseBuffer("a.csv", Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("h1,h2\n1,2")]));
    expect(t.headers).toEqual(["h1", "h2"]);
    expect(t.encoding).toBe("utf-8-sig");
  });

  it("decodes UTF-16LE via BOM", () => {
    const text = "h1,h2\n1,2";
    const buf = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]);
    const t = parseBuffer("a.csv", buf);
    expect(t.headers).toEqual(["h1", "h2"]);
    expect(t.encoding).toBe("utf-16le");
  });

  it("falls back to latin-1 on invalid UTF-8 and says so", () => {
    const t = parseBuffer("a.csv", Buffer.from([0x68, 0x31, 0x0a, 0xe9]));
    expect(t.encoding).toBe("latin-1");
  });

  it("skips footer totals rows and counts them", () => {
    const t = parseBuffer("a.csv", Buffer.from("h1,h2\n1,2\nTOTAL,3\nGrand Total,$5"));
    expect(t.rows).toHaveLength(1);
    expect(t.skipped.filter((s) => s.reason.includes("footer"))).toHaveLength(2);
  });

  it("counts blank and comment lines", () => {
    const t = parseBuffer("a.csv", Buffer.from("h1\n\n# hi\n1\n"));
    expect(t.rows).toHaveLength(1);
    expect(t.skipped.some((s) => s.reason.includes("blank"))).toBe(true);
    expect(t.skipped.some((s) => s.reason.includes("comment"))).toBe(true);
  });

  it("enforces the row cap", () => {
    expect(() => assertRowCap(MAX_ROWS + 1)).toThrow();
    expect(() => assertRowCap(MAX_ROWS)).not.toThrow();
  });

  it("prefers the first visible non-empty sheet and names it", () => {
    const wb = XLSX.utils.book_new();
    wb.SheetNames.push("Hidden", "Data");
    wb.Sheets["Hidden"] = XLSX.utils.aoa_to_sheet([["x"]]);
    wb.Sheets["Data"] = XLSX.utils.aoa_to_sheet([["h1"], ["1"]]);
    wb.Workbook = { Sheets: [{ Hidden: 1 }, { Hidden: 0 }] };
    const buf = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer);
    const t = parseBuffer("a.xlsx", buf);
    expect(t.sheetName).toBe("Data");
    expect(t.headers).toEqual(["h1"]);
  });

  it("reads serial dates and formula caches without crashing", () => {
    const wb = XLSX.utils.book_new();
    wb.SheetNames.push("S");
    const ws = XLSX.utils.aoa_to_sheet([["d", "f"], [new Date(Date.UTC(2026, 8, 7)), 0]]);
    ws["B2"] = { t: "n", f: "1+1", v: 2 };
    wb.Sheets["S"] = ws;
    const buf = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer);
    const t = parseBuffer("a.xlsx", buf);
    expect(t.rows).toHaveLength(1);
    expect(Number.isNaN(Date.parse(t.rows[0][0]))).toBe(false);
  });

  it("reads markup-looking text as literal plain text", () => {
    const wb = XLSX.utils.book_new();
    wb.SheetNames.push("S");
    wb.Sheets["S"] = XLSX.utils.aoa_to_sheet([["h"], ["<b>bold</b> & \"q\""]]);
    const buf = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer);
    expect(parseBuffer("a.xlsx", buf).rows).toEqual([["<b>bold</b> & \"q\""]]);
  });

  it("returns empty for a dataless sheet", () => {
    const wb = XLSX.utils.book_new();
    wb.SheetNames.push("S");
    wb.Sheets["S"] = XLSX.utils.aoa_to_sheet([]);
    const buf = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer);
    expect(parseBuffer("a.xlsx", buf)).toEqual({ headers: [], rows: [], skipped: [], encoding: "xlsx" });
  });
});
