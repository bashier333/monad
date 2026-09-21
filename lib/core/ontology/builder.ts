import type { PropertyKind } from "@/lib/core/ontology/kinds";
import { validateLinkInput, validateTypeInput } from "@/lib/core/ontology/schema";

export interface BuilderProperty {
  key: string;
  kind: PropertyKind;
  label?: string;
  required?: boolean;
  unique?: boolean;
  indexed?: boolean;
  config?: Record<string, unknown>;
}

export interface BuilderType {
  key: string;
  label: string;
  plural?: string;
  description?: string;
  properties: BuilderProperty[];
}

export function defineType(t: BuilderType) {
  const input = {
    key: t.key,
    label: t.label,
    plural: t.plural ?? `${t.label}s`,
    description: t.description ?? "",
    properties: t.properties.map((p) => ({
      key: p.key,
      label: p.label ?? p.key,
      kind: p.kind,
      required: p.required ?? false,
      unique: p.unique ?? false,
      indexed: p.indexed ?? false,
      immutable: false,
      config: p.config,
    })),
  };
  const parsed = validateTypeInput(input);
  if (!parsed.ok) {
    throw new Error(`invalid type ${t.key}: ${parsed.problems.map((p) => `${p.field}: ${p.message}`).join("; ")}`);
  }
  return parsed.value;
}

export function defineLink(link: { key: string; from: string; to: string; cardinality: "one-one" | "one-many" | "many-many"; required?: boolean }, knownTypes: string[]) {
  const parsed = validateLinkInput(
    { key: link.key, fromTypeKey: link.from, toTypeKey: link.to, cardinality: link.cardinality, required: link.required ?? false },
    new Set(knownTypes)
  );
  if (!parsed.ok) {
    throw new Error(`invalid link ${link.key}: ${parsed.problems.map((p) => `${p.field}: ${p.message}`).join("; ")}`);
  }
  return parsed.value;
}

function req(key: string, kind: PropertyKind, label?: string): BuilderProperty {
  return { key, kind, label, required: true, indexed: true };
}

function opt(key: string, kind: PropertyKind, label?: string): BuilderProperty {
  return { key, kind, label };
}

export const TEMPLATES: Record<string, BuilderType[]> = {
  crm: [
    { key: "company", label: "Company", properties: [req("name", "string"), opt("domain", "string"), opt("industry", "string")] },
    { key: "contact", label: "Contact", properties: [req("name", "string"), opt("email", "email"), opt("phone", "phone")] },
    { key: "deal", label: "Deal", properties: [req("title", "string"), req("amount", "currency"), { key: "stage", kind: "enum", config: { options: ["lead", "qualified", "won", "lost"] } }] },
  ],
  inventory: [
    { key: "sku", label: "SKU", properties: [req("code", "string", "Code"), opt("description", "text")] },
    { key: "warehouse", label: "Warehouse", properties: [req("name", "string"), opt("location", "geo")] },
    { key: "movement", label: "Movement", properties: [req("qty", "integer"), req("moved_at", "datetime"), { key: "direction", kind: "enum", config: { options: ["in", "out"] } }] },
  ],
  fleet: [
    { key: "vehicle", label: "Vehicle", properties: [req("unit_number", "string"), opt("year", "integer")] },
    { key: "driver", label: "Driver", properties: [req("name", "string"), opt("phone", "phone"), opt("license_state", "string")] },
    { key: "trip", label: "Trip", properties: [req("started_at", "datetime"), opt("miles", "number"), { key: "status", kind: "enum", config: { options: ["planned", "active", "done"] } }] },
  ],
  projects: [
    { key: "project", label: "Project", properties: [req("name", "string"), opt("due_on", "date"), opt("budget", "currency")] },
    { key: "task", label: "Task", properties: [req("title", "string"), { key: "status", kind: "enum", config: { options: ["todo", "doing", "done"] } }, opt("hours", "number")] },
    { key: "invoice", label: "Invoice", properties: [req("number", "string"), req("amount", "currency"), opt("sent_on", "date")] },
  ],
};

export function buildTemplate(name: string) {
  const types = TEMPLATES[name];
  if (!types) throw new Error(`unknown template ${name}`);
  return types.map(defineType);
}
