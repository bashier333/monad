import { parse as parseCsv } from "csv-parse/sync";
import * as XLSX from "xlsx";

export interface ParsedTable {
  headers: string[];
  rows: string[][];
  skipped: Array<{ rowNumber: number; reason: string }>;
  sheetName?: string;
  encoding: string;
}

export const MAX_ROWS = 500_000;

export function assertRowCap(n: number): void {
  if (n > MAX_ROWS) throw new Error(`too many rows (${n} > ${MAX_ROWS})`);
}

function decodeText(bytes: Buffer): { text: string; encoding: string } {
  const buf = bytes;
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return { text: buf.subarray(3).toString("utf8"), encoding: "utf-8-sig" };
  }
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return { text: buf.subarray(2).toString("utf16le"), encoding: "utf-16le" };
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.alloc(buf.length - 2);
    for (let i = 0; i < swapped.length; i += 2) {
      swapped[i] = buf[i + 3];
      swapped[i + 1] = buf[i + 2];
    }
    return { text: swapped.toString("utf16le"), encoding: "utf-16be" };
  }
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(buf), encoding: "utf-8" };
  } catch {
    return { text: buf.toString("latin1"), encoding: "latin-1" };
  }
}

function isFooterRow(row: string[]): boolean {
  if (row.length === 0) return false;
  if (!/^(grand\s+)?totals?$/i.test((row[0] ?? "").trim())) return false;
  const rest = row.slice(1).filter((c) => c.trim() !== "");
  if (rest.length === 0) return false;
  return rest.every((c) => !Number.isNaN(Number(c.replace(/[$,]/g, ""))));
}

function splitDataFooters(headers: string[], rows: string[][]): { rows: string[][]; skipped: ParsedTable["skipped"] } {
  const kept: string[][] = [];
  const skipped: ParsedTable["skipped"] = [];
  rows.forEach((row, i) => {
    if (isFooterRow(row)) skipped.push({ rowNumber: i + 2, reason: "footer totals row skipped" });
    else kept.push(row);
  });
  void headers;
  return { rows: kept, skipped };
}

export function parseBuffer(filename: string, bytes: Buffer): ParsedTable {
  if (filename.toLowerCase().endsWith(".xlsx")) {
    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.read(bytes, { type: "buffer" });
    } catch {
      throw new Error("unreadable workbook — if password-protected, remove the password and re-upload");
    }
    const sheets = wb.SheetNames;
    const hidden = (name: string) => {
      const idx = wb.SheetNames.indexOf(name);
      const props = wb.Workbook?.Sheets?.[idx] as { Hidden?: number } | undefined;
      return props?.Hidden === 1;
    };
    const pick = sheets.find((s) => {
      const ws = wb.Sheets[s];
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "" });
      return aoa.length > 0;
    });
    const visible = sheets.find((s) => {
      if (hidden(s)) return false;
      const ws = wb.Sheets[s];
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "" });
      return aoa.length > 0;
    });
    const chosen = visible ?? pick;
    if (!chosen) return { headers: [], rows: [], skipped: [], encoding: "xlsx" };
    const sheet = wb.Sheets[chosen];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
    const norm = aoa.map((r) => (Array.isArray(r) ? r.map((c) => String(c)) : []));
    const [headers = [], ...rows] = norm;
    assertRowCap(rows.length);
    const split = splitDataFooters(headers, rows);
    return {
      headers: headers.map((h) => h.trim()),
      rows: split.rows,
      skipped: split.skipped,
      sheetName: chosen,
      encoding: "xlsx",
    };
  }
  const { text, encoding } = decodeText(bytes);
  let blankLines = 0;
  let commentLines = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "") blankLines++;
    else if (/^\s*#/.test(line)) commentLines++;
  }
  const records = parseCsv(text, {
    skip_empty_lines: true,
    relax_column_count: true,
    comment: "#",
  }) as string[][];
  const [headers = [], ...rows] = records;
  assertRowCap(rows.length);
  const split = splitDataFooters(headers, rows);
  const skipped = [...split.skipped];
  if (blankLines > 0) skipped.push({ rowNumber: -1, reason: `${blankLines} blank lines skipped (single-table assumption — verify)` });
  if (commentLines > 0) skipped.push({ rowNumber: -1, reason: `${commentLines} #-comment lines skipped` });
  if (headers.length === 0) return { headers: [], rows: [], skipped, encoding };
  return { headers: headers.map((h) => String(h).trim()), rows: split.rows.map((r) => r.map(String)), skipped, encoding };
}
