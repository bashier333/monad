import { applyMapping, detectColumns } from "@/lib/core/ingest/columns";
import { getAdapter, registerAdapter, type SourceAdapter } from "@/lib/core/ingest/adapters";
import { AGENCY_ALIASES, AGENCY_FIELDS, agencyLoadKey, isAgencySource, type AgencyField } from "@/lib/packs/agency/sources";
import { validateAgencyRow } from "@/lib/packs/agency/validate";

export const agencyAdapter: SourceAdapter = {
  sourceTypes: ["time", "revision", "invoice", "asset", "rate"],
  detect: (headers) => {
    const s = detectColumns(headers, AGENCY_FIELDS, AGENCY_ALIASES);
    return { mapping: s.mapping as Record<string, number>, confidence: s.confidence as Record<string, number> };
  },
  apply: (headers, rows, mapping) =>
    applyMapping(headers, rows, mapping, AGENCY_FIELDS).map((m) => ({
      rowNumber: m.rowNumber,
      record: m.record as Record<string, string>,
    })),
  validate: (record, seen, sourceType) =>
    validateAgencyRow(record as Record<AgencyField, string>, seen, sourceType).map((i) => ({ ...i })),
  loadKey: (record) => agencyLoadKey(record as Record<AgencyField, string>),
  dateOf: (record) => (record as Record<AgencyField, string>).date ?? "",
};

registerAdapter(agencyAdapter);

export { getAdapter, isAgencySource };
