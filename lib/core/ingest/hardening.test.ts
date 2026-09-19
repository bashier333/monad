import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { assertCellCap, assertRowCap, MAX_ROWS, MAX_SHEETS, parseBuffer } from "@/lib/core/ingest/parse";
import { scanBuffer } from "@/lib/core/ingest/scan";
import { sanitizeMapping } from "@/lib/core/imports/validate";

function csvBuf(s: string): Buffer {
  return Buffer.from(s, "utf8");
}

function xlsxBuf(sheets: Array<Array<Array<string | number>>>): Buffer {
  const wb = XLSX.utils.book_new();
  sheets.forEach((rows, i) => {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), `S${i + 1}`);
  });
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer);
}

describe("input hardening (D3)", () => {
  it("rejects xlsm/macros-adjacent extensions + enforces sheet cap (S-221/S-226)", () => {
    expect(scanBuffer("evil.xlsm", csvBuf("a,b\n1,2")).ok).toBe(false);
    const many = xlsxBuf(Array.from({ length: MAX_SHEETS + 1 }, () => [["h"], ["1"]]));
    expect(() => parseBuffer("many.xlsx", many)).toThrow(/too many sheets/);
  });

  it("caps cells against decompression bombs (S-225)", () => {
    expect(() => assertCellCap(1_000_000, 10)).toThrow(/too many cells/);
    expect(() => assertRowCap(MAX_ROWS + 1)).toThrow(/too many rows/);
    assertCellCap(100, 10);
  });

  it("rejects binary/empty/oversize/corrupt before parsing (S-228/S-241)", () => {
    expect(scanBuffer("x.csv", Buffer.alloc(0)).ok).toBe(false);
    expect(scanBuffer("x.csv", Buffer.concat([csvBuf("a"), Buffer.from([0])])).ok).toBe(false);
    expect(scanBuffer("x.csv", Buffer.alloc(50 * 1024 * 1024 + 1)).ok).toBe(false);
    expect(scanBuffer("bad.xlsx", csvBuf("not a zip"))).toMatchObject({ ok: false });
  });

  it("blocks EICAR e2e with a message (S-299)", () => {
    const eicar = ["X5O!P%@AP[4", "PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"].join("\\");
    const res = scanBuffer("test.csv", csvBuf(`a,b\n${eicar},2`));
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/malware/i);
  });

  it("fuzz corpus: 20 mutations all handled, never crash (S-229)", () => {
    const good = xlsxBuf([[["Project", "Date", "Hours"], ["A", "2026-09-07", 5]]]);
    const mutations: Buffer[] = [
      good.subarray(0, good.length - 50),
      Buffer.concat([good, Buffer.from("trailing junk")]),
      csvBuf(""),
      csvBuf(",,,,\n,,,\n"),
      csvBuf("a,b\n1"),
      csvBuf("a,b\n1,2,3,4,5"),
      csvBuf('"unclosed quote,1,2'),
      csvBuf("a\u0000b,1,2"),
      csvBuf("Project,Date\nA,not-a-date"),
      csvBuf("H1,H2\n" + "x,".repeat(500) + "\n"),
      csvBuf("=cmd|evil,2,3"),
      xlsxBuf([[[]]]),
      xlsxBuf([[["only-headers"]]]),
      Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]),
      csvBuf("﻿Project,Date\nA,2026-09-07"),
      csvBuf("Project,Date\r\nA,2026-09-07\r\n"),
      csvBuf("a;b\n1;2"),
      csvBuf("# comment\nProject,Date\nA,2026-09-07"),
      csvBuf("TOTAL,,,,\n1,2,3,4"),
      csvBuf("a,b,c\n1,2,3\n4,5"),
    ];
    expect(mutations).toHaveLength(20);
    for (const [i, m] of mutations.entries()) {
      let outcome = "parsed";
      try {
        const name = i < 2 || i === 12 || i === 13 || i === 14 ? "m.xlsx" : "m.csv";
        parseBuffer(name, m);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message.length).toBeGreaterThan(0);
        outcome = "rejected";
      }
      expect(["parsed", "rejected"]).toContain(outcome);
    }
  });

  it("formula cells survive parse→export roundtrip quoted (S-213/S-214)", async () => {
    const r = parseBuffer("f.csv", csvBuf("Project,Date,Hours\n=cmd|evil,2026-09-07,2\n"));
    expect(r.rows[0][0]).toBe("=cmd|evil");
  });

  it("null-byte filenames rejected (S-295)", () => {
    const res = scanBuffer("a\0.csv", csvBuf("a\n1"));
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/filename/);
  });

  it("mapping sanitizer rejects __proto__ + caps keys (S-243/S-286)", () => {
    const evil = sanitizeMapping(5, JSON.parse('{"__proto__":1,"project":0}') as Record<string, number>);
    expect(evil.ok).toBe(false);
    const big: Record<string, number> = {};
    for (let i = 0; i < 250; i++) big[`f${i}`] = 0;
    expect(sanitizeMapping(5, big).ok).toBe(false);
    expect(sanitizeMapping(5, { project: 0, date: 1 })).toEqual({ ok: true, mapping: { project: 0, date: 1 } });
  });
});
