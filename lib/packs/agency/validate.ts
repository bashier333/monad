import { AGENCY_ALIASES, AGENCY_FIELDS, type AgencyField } from "@/lib/packs/agency/fields";

export interface AgencyRowIssue {
  field: string;
  code: string;
  message: string;
}

const NUMERIC: AgencyField[] = ["hours", "rate", "amount", "revenue"];

export function validateAgencyRow(
  record: Record<AgencyField, string>,
  seen: Set<string>,
  sourceType: string,
): AgencyRowIssue[] {
  const issues: AgencyRowIssue[] = [];
  const required: AgencyField[] =
    sourceType === "invoice" ? ["project", "amount"] : ["project", "date"];

  for (const field of required) {
    if (!record[field]) {
      issues.push({ field, code: "REQUIRED", message: `${field} is missing` });
    }
  }

  if (record.date && Number.isNaN(Date.parse(record.date))) {
    issues.push({ field: "date", code: "INVALID_DATE", message: `unparseable date: ${record.date}` });
  }

  for (const field of NUMERIC) {
    const v = record[field];
    if (!v) continue;
    const n = Number(v.replace(/[$,]/g, ""));
    if (Number.isNaN(n)) {
      issues.push({ field, code: "INVALID_NUMBER", message: `${field} is not a number: ${v}` });
    } else if (n < 0) {
      issues.push({ field, code: "NEGATIVE_VALUE", message: `${field} is negative: ${v}` });
    }
  }

  const dupKey = `${sourceType}:${record.project}|${record.date}|${record.person}|${record.task}`;
  if (record.project && seen.has(dupKey)) {
    issues.push({ field: "project", code: "DUPLICATE_KEY", message: `duplicate entry: ${record.project} ${record.date}` });
  } else if (record.project) {
    seen.add(dupKey);
  }

  for (const v of Object.values(record)) {
    if (v.includes("�")) {
      issues.push({ field: "*", code: "ENCODING", message: "replacement character found" });
      break;
    }
  }
  return issues;
}
