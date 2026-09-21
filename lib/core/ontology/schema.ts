import { z } from "zod";
import { PROPERTY_KINDS, validateKindConfig } from "@/lib/core/ontology/kinds";

export const KEY_RE = /^[a-z][a-z0-9_]{1,63}$/;

const RESERVED_KEYS = new Set([
  "id",
  "orgid",
  "organizationid",
  "createdat",
  "updatedat",
  "deletedat",
  "type",
  "version",
]);

export function isReservedKey(key: string): boolean {
  return RESERVED_KEYS.has(key.toLowerCase());
}

export const propertySchema = z.object({
  key: z.string().regex(KEY_RE, "key must be snake_case, 2-64 chars"),
  label: z.string().max(120).default(""),
  kind: z.enum(PROPERTY_KINDS),
  required: z.boolean().default(false),
  unique: z.boolean().default(false),
  indexed: z.boolean().default(false),
  immutable: z.boolean().default(false),
  config: z.record(z.unknown()).optional(),
});

export const typeSchema = z.object({
  key: z.string().regex(KEY_RE, "key must be snake_case, 2-64 chars"),
  label: z.string().min(1).max(120),
  plural: z.string().max(120).default(""),
  description: z.string().max(2000).default(""),
  properties: z.array(propertySchema).max(200).default([]),
});

export const CARDINALITIES = ["one-one", "one-many", "many-many"] as const;
export type Cardinality = (typeof CARDINALITIES)[number];

export const linkSchema = z.object({
  key: z.string().regex(KEY_RE, "key must be snake_case, 2-64 chars"),
  fromTypeKey: z.string().min(1).max(64),
  toTypeKey: z.string().min(1).max(64),
  cardinality: z.enum(CARDINALITIES),
  required: z.boolean().default(false),
});

export interface SchemaProblem {
  field: string;
  message: string;
}

export function validateTypeInput(input: unknown): { ok: true; value: z.infer<typeof typeSchema> } | { ok: false; problems: SchemaProblem[] } {
  const parsed = typeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    };
  }
  const problems: SchemaProblem[] = [];
  if (isReservedKey(parsed.data.key)) problems.push({ field: "key", message: "reserved key" });
  const seen = new Set<string>();
  for (const p of parsed.data.properties) {
    if (seen.has(p.key)) problems.push({ field: `properties.${p.key}`, message: "duplicate property key" });
    seen.add(p.key);
    if (isReservedKey(p.key)) problems.push({ field: `properties.${p.key}`, message: "reserved key" });
    for (const m of validateKindConfig(p.kind, p.config as Record<string, unknown> | undefined)) {
      problems.push({ field: `properties.${p.key}.config`, message: m });
    }
  }
  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, value: parsed.data };
}

export function validateLinkInput(
  input: unknown,
  knownTypes: Set<string>
): { ok: true; value: z.infer<typeof linkSchema> } | { ok: false; problems: SchemaProblem[] } {
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    };
  }
  const problems: SchemaProblem[] = [];
  if (isReservedKey(parsed.data.key)) problems.push({ field: "key", message: "reserved key" });
  if (!knownTypes.has(parsed.data.fromTypeKey)) {
    problems.push({ field: "fromTypeKey", message: "unknown type" });
  }
  if (!knownTypes.has(parsed.data.toTypeKey)) {
    problems.push({ field: "toTypeKey", message: "unknown type" });
  }
  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, value: parsed.data };
}
