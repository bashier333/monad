export const SOURCE_BY_FILENAME: Array<{ sourceType: string; patterns: string[] }> = [
  { sourceType: "fuel", patterns: ["fuel", "gas", "diesel"] },
  { sourceType: "broker", patterns: ["broker", "statement", "factor"] },
  { sourceType: "time", patterns: ["harvest", "toggl", "time", "timesheet", "hours"] },
  { sourceType: "revision", patterns: ["revision", "frame", "frameio", "review"] },
  { sourceType: "approval", patterns: ["approval", "signoff", "sign-off"] },
  { sourceType: "invoice", patterns: ["invoice", "quickbooks", "qb", "bill"] },
  { sourceType: "asset", patterns: ["asset", "manifest"] },
  { sourceType: "rate", patterns: ["rate", "ratecard", "rate-card"] },
  { sourceType: "project", patterns: ["project", "asana"] },
  { sourceType: "feedback", patterns: ["feedback", "comment"] },
];

export function suggestSourceType(filename: string): string | null {
  const name = filename.toLowerCase();
  for (const entry of SOURCE_BY_FILENAME) {
    for (const p of entry.patterns) {
      if (name.includes(p)) return entry.sourceType;
    }
  }
  return null;
}

export function resolveSourceType(filename: string, chosen: string): string {
  if (chosen !== "auto") return chosen;
  return suggestSourceType(filename) ?? "tms";
}
