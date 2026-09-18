import {
  applyMapping,
  detectColumns,
  type CanonicalField,
} from "@/lib/core/ingest/columns";
import { registerAdapter, type SourceAdapter } from "@/lib/core/ingest/adapters";
import { validateOptionsFor, validateRow } from "@/lib/core/ingest/validate";

export const FREIGHT_SOURCE_TYPES = ["tms", "fuel", "broker", "manual"];

export const freightAdapter: SourceAdapter = {
  sourceTypes: FREIGHT_SOURCE_TYPES,
  detect: (headers) => {
    const s = detectColumns(headers);
    return { mapping: s.mapping as Record<string, number>, confidence: s.confidence as Record<string, number> };
  },
  apply: (headers, rows, mapping) =>
    applyMapping(headers, rows, mapping as Partial<Record<CanonicalField, number>>).map((m) => ({
      rowNumber: m.rowNumber,
      record: m.record as Record<string, string>,
    })),
  validate: (record, seen, sourceType) =>
    validateRow(record as Record<CanonicalField, string>, seen, validateOptionsFor(sourceType)).map((i) => ({ ...i })),
  loadKey: (record) => (record as Record<CanonicalField, string>).loadId || null,
  dateOf: (record) => (record as Record<CanonicalField, string>).date ?? "",
};

registerAdapter(freightAdapter);
