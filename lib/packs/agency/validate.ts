import type { AgencyField } from "@/lib/packs/agency/fields";

export interface AgencyRowIssue {
  field: string;
  code: string;
  message: string;
}

const REQUIRED_BY_SOURCE: Record<string, AgencyField[]> = {
  time: ["project", "date"],
  revision: ["project", "date"],
  approval: ["project", "sentDate"],
  invoice: ["project", "amount"],
  asset: ["asset"],
  rate: ["rate"],
  project: ["project"],
  feedback: ["round"],
};

function parseRound(v: string): number | null {
  const m = v.match(/(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) ? n : null;
}

const NUMERIC: AgencyField[] = ["hours", "rate", "amount", "revenue"];

export function validateAgencyRow(
  record: Record<AgencyField, string>,
  seen: Set<string>,
  sourceType: string,
): AgencyRowIssue[] {
  const issues: AgencyRowIssue[] = [];
  const required = REQUIRED_BY_SOURCE[sourceType] ?? ["project", "date"];

  for (const field of required) {
    if (!record[field]) {
      issues.push({ field, code: "REQUIRED", message: `${field} is missing` });
    }
  }

  if (record.date && Number.isNaN(Date.parse(record.date))) {
    issues.push({ field: "date", code: "INVALID_DATE", message: `unparseable date: ${record.date}` });
  }

  if (record.sentDate && record.signedDate) {
    const sent = Date.parse(record.sentDate);
    const signed = Date.parse(record.signedDate);
    if (!Number.isNaN(sent) && !Number.isNaN(signed) && signed < sent) {
      issues.push({ field: "signedDate", code: "APPROVAL_ORDER", message: `signed ${record.signedDate} before sent ${record.sentDate}` });
    }
  }

  const round = parseRound(record.round ?? "");
  if (round !== null && record.project) {
    // Stricter than the E-167 letter ("gaps flagged, not blocked"): jumps quarantine
    // so a human confirms renumbered rounds before margins use them. Only rows that
    // carry a round number pay the prefix scan, so plain time exports stay O(n).
    const prefix = `roundseen:${sourceType}:${record.project.toLowerCase()}:`;
    let max = 0;
    for (const k of seen) {
      if (!k.startsWith(prefix)) continue;
      const n = Number(k.slice(prefix.length));
      if (Number.isSafeInteger(n) && n > max) max = n;
    }
    if (max > 0 && round > max + 1) {
      issues.push({ field: "round", code: "ROUND_GAP", message: `round ${record.round} jumps past round ${max} for ${record.project}` });
    }
    seen.add(`${prefix}${round}`);
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

  const dupKey = `${sourceType}:${record.project}|${record.date}|${record.person}|${record.task}|${record.round ?? ""}`;
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
