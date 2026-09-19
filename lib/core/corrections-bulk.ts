export interface BulkRow {
  targetKey?: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
}

export function validateBulkRow(row: BulkRow): string | null {
  if (!row.targetKey || !row.field) return "every row needs targetKey and field";
  if ((row.reason ?? "").length > 5000) return "reason too long (max 5000)";
  return null;
}

export function validateBulkRows(rows: unknown): { ok: true; rows: BulkRow[] } | { ok: false; error: string } {
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: "rows required (max 100)" };
  if (rows.length > 100) return { ok: false, error: "at most 100 rows per request" };
  for (const row of rows as BulkRow[]) {
    const err = validateBulkRow(row);
    if (err) return { ok: false, error: err };
  }
  return { ok: true, rows: rows as BulkRow[] };
}
