// Board filter engine: applies widget-published filters to rows. Pure —
// the canvas calls it on every filter.set; tests cover every operator.
// Unknown fields are reported (never silently dropped); empty filters pass
// everything through.

export type FilterOp = "eq" | "neq" | "contains" | "gte" | "lte" | "in";

export interface FieldFilter {
  op: FilterOp;
  value: unknown;
}

export type BoardFilters = Record<string, FieldFilter | string | number | boolean | null | undefined>;

export interface FilterOutcome {
  rows: Array<Record<string, unknown>>;
  ignored: string[];
}

function testOne(raw: unknown, filter: FieldFilter): boolean {
  const { op, value } = filter;
  switch (op) {
    case "eq":
      return JSON.stringify(raw ?? null) === JSON.stringify(value ?? null);
    case "neq":
      return JSON.stringify(raw ?? null) !== JSON.stringify(value ?? null);
    case "contains":
      return String(raw ?? "").toLowerCase().includes(String(value ?? "").toLowerCase());
    case "gte":
      return Number(raw) >= Number(value) && Number.isFinite(Number(raw)) && Number.isFinite(Number(value));
    case "lte":
      return Number(raw) <= Number(value) && Number.isFinite(Number(raw)) && Number.isFinite(Number(value));
    case "in":
      return Array.isArray(value) && value.some((v) => JSON.stringify(v) === JSON.stringify(raw ?? null));
  }
}

export function normalizeFilters(filters: BoardFilters): { active: Record<string, FieldFilter>; ignored: string[] } {
  const active: Record<string, FieldFilter> = {};
  const ignored: string[] = [];
  for (const [field, f] of Object.entries(filters)) {
    if (f === undefined || f === null || f === "") continue;
    if (typeof f === "object" && f !== null && "op" in (f as unknown as Record<string, unknown>)) {
      const op = (f as FieldFilter).op;
      if (op === "eq" || op === "neq" || op === "contains" || op === "gte" || op === "lte" || op === "in") {
        active[field] = f as FieldFilter;
      } else {
        ignored.push(field);
      }
      continue;
    }
    if (typeof f === "string" || typeof f === "number" || typeof f === "boolean") {
      active[field] = { op: typeof f === "string" ? "contains" : "eq", value: f };
    } else {
      ignored.push(field);
    }
  }
  return { active, ignored };
}

export function applyBoardFilters(
  rows: Array<Record<string, unknown>>,
  filters: BoardFilters,
  knownFields?: Set<string>,
): FilterOutcome {
  const { active, ignored: malformed } = normalizeFilters(filters);
  const ignored = [...malformed];
  const applicable = Object.entries(active).filter(([field]) => {
    if (knownFields && !knownFields.has(field)) {
      ignored.push(field);
      return false;
    }
    return true;
  });
  if (applicable.length === 0) return { rows, ignored };
  return {
    rows: rows.filter((row) => applicable.every(([field, f]) => testOne(row[field], f))),
    ignored,
  };
}
