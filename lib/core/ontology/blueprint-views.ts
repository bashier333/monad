// Export views: render the pack manifest as LinkML YAML and SHACL JSON.
// These are EXPORT ARTIFACTS, not dependencies — the canonical model stays
// in OntoType/OntoLink/OntoAction rows. Both formats are honest about what
// they cannot carry: LinkML has no actions/approvals/policies (emitted as
// annotations for reference), SHACL validates shape only (no behavior, no
// row-policies, no latitude). Every slot/property carries an
// x-monad-kind annotation with the original property kind so OUR importer
// can round-trip; third-party round-trip is explicitly not claimed.
import type { PropertyKind } from "@/lib/core/ontology/kinds";

export interface ViewProperty {
  key: string;
  label: string;
  kind: string;
  required: boolean;
  unique: boolean;
  config?: Record<string, unknown> | null;
}

export interface ViewType {
  key: string;
  label: string;
  description?: string;
  properties: ViewProperty[];
}

export interface ViewLink {
  key: string;
  fromTypeKey: string;
  toTypeKey: string;
  cardinality: string;
  inverseKey?: string | null;
}

export interface PackView {
  types: ViewType[];
  links: ViewLink[];
  exportedAt: string;
}

// LinkML range per property kind. Lossy kinds map to the closest built-in
// with the original preserved in annotations (see slot annotations below).
function linkMLRange(kind: string, config?: Record<string, unknown> | null): { range: string; extra: Record<string, unknown> } {
  switch (kind as PropertyKind) {
    case "integer":
      return { range: "integer", extra: {} };
    case "number":
    case "currency":
    case "percent":
    case "duration":
      return { range: "float", extra: {} };
    case "boolean":
      return { range: "boolean", extra: {} };
    case "date":
      return { range: "date", extra: {} };
    case "datetime":
      return { range: "datetime", extra: {} };
    case "enum": {
      const options = Array.isArray(config?.options) ? (config.options as unknown[]) : [];
      return { range: "string", extra: { permissible_values: options.map(String) } };
    }
    case "reference":
      return { range: "string", extra: { annotations: { "x-monad-reference": true } } };
    case "multi_reference":
      return { range: "string", extra: { multivalued: true } };
    case "geo":
      return { range: "MonadGeoPoint", extra: {} };
    case "file":
    case "phone":
    case "email":
    case "url":
    case "string":
    case "text":
      return { range: "string", extra: {} };
    case "json":
      return { range: "string", extra: { annotations: { "x-monad-json": true } } };
    case "computed":
      return { range: "string", extra: { annotations: { "x-monad-computed-readonly": true } } };
    default:
      return { range: "string", extra: { annotations: { "x-monad-unknown-kind": kind } } };
  }
}

function yamlScalar(value: unknown): string {
  // JSON scalars are valid YAML flow scalars — no custom escaper to get wrong.
  return JSON.stringify(value) ?? "null";
}

function indent(line: string, spaces: number): string {
  return `${" ".repeat(spaces)}${line}`;
}

export function toLinkML(pack: PackView): string {
  const out: string[] = [
    "# LinkML view of the ontology pack. GENERATED — do not hand-edit.",
    "# Lossy by design: actions, approvals, row-policies, and latitude tiers",
    "# have no LinkML equivalent and are NOT in this file (see the v1 JSON",
    "# blueprint for the full model). Original kinds survive in",
    "# x-monad-kind annotations for our own importer.",
    `id: https://monad.local/blueprint/${pack.exportedAt.slice(0, 10)}`,
    "name: monad-ontology-pack",
    "title: Monad ontology pack (LinkML view)",
    "license: https://opensource.org/licenses/MIT",
    "prefixes:",
    "  monad: https://monad.local/ontology/",
    "  linkml: https://w3id.org/linkml/",
    "default_range: string",
    "classes:",
  ];
  out.push(
    "  MonadGeoPoint:",
    "    description: Latitude/longitude pair for geo-kind properties.",
    "    attributes:",
    "      lat:",
    "        range: float",
    "      lng:",
    "        range: float"
  );
  for (const t of pack.types) {
    out.push(`  ${t.key}:`);
    out.push(indent(`description: ${yamlScalar(t.description ?? t.label)}`, 4));
    out.push(indent("attributes:", 4));
    for (const p of t.properties) {
      const { range, extra } = linkMLRange(p.kind, p.config ?? undefined);
      out.push(indent(`${p.key}:`, 6));
      out.push(indent(`description: ${yamlScalar(p.label)}`, 8));
      out.push(indent(`range: ${range}`, 8));
      if (p.required) out.push(indent("required: true", 8));
      if (p.unique) out.push(indent("annotations:", 8), indent("x-monad-unique: true", 10));
      out.push(indent("annotations:", 8), indent(`x-monad-kind: ${yamlScalar(p.kind)}`, 10));
      if (typeof extra.multivalued === "boolean") out.push(indent(`multivalued: ${extra.multivalued}`, 8));
      if (Array.isArray(extra.permissible_values)) {
        out.push(indent("permissible_values:", 8));
        for (const v of extra.permissible_values as string[]) out.push(indent(`- ${yamlScalar(v)}`, 10));
      }
      const annotations = extra.annotations as Record<string, unknown> | undefined;
      if (annotations) {
        for (const [k, v] of Object.entries(annotations)) out.push(indent(`${k}: ${yamlScalar(v)}`, 10));
      }
    }
  }
  if (pack.links.length > 0) {
    out.push("slots:");
    for (const l of pack.links) {
      out.push(`  ${l.key}:`);
      out.push(indent(`description: ${yamlScalar(`${l.fromTypeKey} to ${l.toTypeKey} (${l.cardinality})`)}`, 4));
      out.push(indent(`domain: ${l.fromTypeKey}`, 4));
      out.push(indent(`range: ${l.toTypeKey}`, 4));
      out.push(indent(`multivalued: ${l.cardinality === "one-one" ? "false" : "true"}`, 4));
      if (l.inverseKey) out.push(indent(`inverse: ${l.inverseKey}`, 4));
    }
  }
  return `${out.join("\n")}\n`;
}

const XSD: Record<string, string> = {
  string: "http://www.w3.org/2001/XMLSchema#string",
  integer: "http://www.w3.org/2001/XMLSchema#integer",
  float: "http://www.w3.org/2001/XMLSchema#decimal",
  boolean: "http://www.w3.org/2001/XMLSchema#boolean",
  date: "http://www.w3.org/2001/XMLSchema#date",
  datetime: "http://www.w3.org/2001/XMLSchema#dateTime",
};

function shaclDatatype(kind: string): string {
  switch (kind as PropertyKind) {
    case "integer":
      return XSD.integer!;
    case "number":
    case "currency":
    case "percent":
    case "duration":
      return XSD.float!;
    case "boolean":
      return XSD.boolean!;
    case "date":
      return XSD.date!;
    case "datetime":
      return XSD.datetime!;
    default:
      return XSD.string!;
  }
}

// SHACL JSON view: one NodeShape per type. Validates shape only — closed
// shapes (sh:closed true) mirror our closed-world writes. Behavior,
// policies, and approvals are NOT here (see the v1 JSON blueprint).
export function toShacl(pack: PackView): Record<string, unknown> {
  const shapes: unknown[] = [];
  for (const t of pack.types) {
    const properties: unknown[] = [];
    for (const p of t.properties) {
      const prop: Record<string, unknown> = {
        "sh:path": `monad:${p.key}`,
        "sh:datatype": shaclDatatype(p.kind),
        "sh:minCount": p.required ? 1 : 0,
        "sh:maxCount": p.kind === "multi_reference" ? undefined : 1,
        "sh:description": p.label,
        "x-monad-kind": p.kind,
      };
      if (p.unique) prop["x-monad-unique"] = true;
      if (p.kind === "enum" && p.config && Array.isArray((p.config as Record<string, unknown>).options)) {
        prop["sh:in"] = ((p.config as Record<string, unknown>).options as unknown[]).map(String);
      }
      if (p.kind === "geo") {
        prop["sh:node"] = "monad:GeoPointShape";
        delete prop["sh:datatype"];
      }
      for (const k of Object.keys(prop)) if (prop[k] === undefined) delete prop[k];
      properties.push(prop);
    }
    shapes.push({
      "@id": `monad:${t.key}Shape`,
      "@type": "sh:NodeShape",
      "sh:targetClass": `monad:${t.key}`,
      "sh:closed": true,
      "sh:description": t.description ?? t.label,
      "sh:property": properties,
    });
  }
  shapes.push({
    "@id": "monad:GeoPointShape",
    "@type": "sh:NodeShape",
    "sh:closed": true,
    "sh:property": [
      { "sh:path": "monad:lat", "sh:datatype": XSD.float, "sh:minCount": 1, "sh:maxCount": 1 },
      { "sh:path": "monad:lng", "sh:datatype": XSD.float, "sh:minCount": 1, "sh:maxCount": 1 },
    ],
  });
  for (const l of pack.links) {
    shapes.push({
      "@id": `monad:${l.key}Link`,
      "@type": "sh:PropertyShape",
      "sh:path": `monad:${l.key}`,
      "sh:class": `monad:${l.toTypeKey}`,
      "sh:minCount": 0,
      ...(l.cardinality === "one-one" ? { "sh:maxCount": 1 } : {}),
      "x-monad-cardinality": l.cardinality,
      "x-monad-from": l.fromTypeKey,
    });
  }
  return {
    "@context": {
      monad: "https://monad.local/ontology/",
      sh: "http://www.w3.org/ns/shacl#",
      xsd: "http://www.w3.org/2001/XMLSchema#",
    },
    "@comment":
      "SHACL view of the ontology pack. GENERATED — shape validation only; actions, approvals, row-policies, and latitude are not expressible here (see the v1 JSON blueprint).",
    "@graph": shapes,
  };
}
