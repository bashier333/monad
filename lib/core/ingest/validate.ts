import type { CanonicalField } from "@/lib/core/ingest/columns";

export interface RowIssue {
  field: string;
  code: string;
  message: string;
}

export interface ValidateOptions {
  required: CanonicalField[];
  checkDuplicatesOn?: CanonicalField;
}

const NUMERIC_FIELDS: CanonicalField[] = ["miles", "revenue", "gallons", "amount", "detention", "fee"];

export function validateRow(
  record: Record<CanonicalField, string>,
  seen: Set<string>,
  opts: ValidateOptions,
): RowIssue[] {
  const issues: RowIssue[] = [];

  for (const v of Object.values(record)) {
    if (v.includes("�")) {
      issues.push({ field: "*", code: "ENCODING", message: "replacement character found — source encoding suspect" });
      break;
    }
  }

  for (const field of opts.required) {
    if (!record[field]) {
      issues.push({ field, code: "REQUIRED", message: `${field} is missing` });
    }
  }

  if (record.date && Number.isNaN(Date.parse(record.date))) {
    issues.push({ field: "date", code: "INVALID_DATE", message: `unparseable date: ${record.date}` });
  }

  for (const field of NUMERIC_FIELDS) {
    const v = record[field];
    if (!v) continue;
    const n = Number(v.replace(/[$,]/g, ""));
    if (Number.isNaN(n)) {
      issues.push({ field, code: "INVALID_NUMBER", message: `${field} is not a number: ${v}` });
    } else if (n < 0) {
      issues.push({ field, code: "NEGATIVE_VALUE", message: `${field} is negative: ${v}` });
    }
  }

  if (opts.checkDuplicatesOn) {
    const key = record[opts.checkDuplicatesOn];
    if (key) {
      if (seen.has(key)) {
        issues.push({
          field: opts.checkDuplicatesOn,
          code: "DUPLICATE_KEY",
          message: `duplicate ${opts.checkDuplicatesOn}: ${key}`,
        });
      } else {
        seen.add(key);
      }
    }
  }

  return issues;
}

export function validateOptionsFor(sourceType: string): ValidateOptions {
  if (sourceType === "fuel") {
    return { required: ["truck", "date", "amount"] };
  }
  if (sourceType === "broker") {
    return { required: ["loadId"], checkDuplicatesOn: "loadId" };
  }
  return { required: ["loadId", "date", "revenue"], checkDuplicatesOn: "loadId" };
}
