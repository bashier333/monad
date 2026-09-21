export type Row = Record<string, unknown>;

function nums(rows: Row[], field: string): number[] {
  const out: number[] = [];
  for (const r of rows) {
    const v = r[field];
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

export function groupBy(rows: Row[], keyFn: (r: Row) => string): Map<string, Row[]> {
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = keyFn(r);
    const g = groups.get(k) ?? [];
    g.push(r);
    groups.set(k, g);
  }
  return groups;
}

export function sum(rows: Row[], field: string): number {
  return nums(rows, field).reduce((a, b) => a + b, 0);
}

export function avg(rows: Row[], field: string): number | null {
  const values = nums(rows, field);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(rows: Row[], field: string): number | null {
  const values = nums(rows, field).sort((a, b) => a - b);
  if (values.length === 0) return null;
  const mid = Math.floor(values.length / 2);
  return values.length % 2 === 1 ? values[mid]! : (values[mid - 1]! + values[mid]!) / 2;
}

export function distinctCount(rows: Row[], field: string): number {
  return new Set(rows.map((r) => JSON.stringify(r[field] ?? null))).size;
}

export interface DatedRow extends Row {
  date: string;
}

export function trailingSum(rows: DatedRow[], field: string, endDate: string, days: number): number {
  const end = new Date(endDate).getTime();
  const start = end - days * 86400000;
  return sum(
    rows.filter((r) => {
      const t = new Date(r.date).getTime();
      return t <= end && t > start;
    }),
    field
  );
}

export function weekOverWeek(rows: DatedRow[], field: string, weekStart: string): number | null {
  const start = new Date(weekStart).getTime();
  const thisWeek = rows.filter((r) => {
    const t = new Date(r.date).getTime();
    return t >= start && t < start + 7 * 86400000;
  });
  const lastWeek = rows.filter((r) => {
    const t = new Date(r.date).getTime();
    return t >= start - 7 * 86400000 && t < start;
  });
  const a = sum(thisWeek, field);
  const b = sum(lastWeek, field);
  if (b === 0) return null;
  return (a - b) / Math.abs(b);
}
