import { AGENCY_ALIASES, AGENCY_FIELDS, type AgencyField } from "@/lib/packs/agency/fields";

export const AGENCY_SOURCE_TYPES = ["time", "revision", "approval", "invoice", "asset", "rate", "project", "feedback"] as const;
export type AgencySourceType = (typeof AGENCY_SOURCE_TYPES)[number];

export function isAgencySource(sourceType: string): boolean {
  return (AGENCY_SOURCE_TYPES as readonly string[]).includes(sourceType);
}

function norm(s: string): string {
  return s.trim().toUpperCase().replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

export function agencyLoadKey(record: Record<AgencyField, string>): string | null {
  const parts = [record.project, record.date, record.person, record.task]
    .map((v) => norm(v ?? ""))
    .filter(Boolean);
  if (parts.length < 2) return null;
  return parts.join("|");
}

export { AGENCY_ALIASES, AGENCY_FIELDS };
export type { AgencyField };
