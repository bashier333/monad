import type { ActionDef, ActionEffect } from "@/lib/core/ontology/actions";

// ---------------------------------------------------------------------------
// Action forms: button-group / inline-action widgets auto-generate their
// forms FROM the action definition — never hand-built per action. This module
// derives the field list from $inputs.* references in effects and validates
// submissions before preview. $fn.* refs are computed, never user fields.
// ---------------------------------------------------------------------------

export type FormFieldKind = "text" | "number" | "select" | "object" | "textarea";

export interface FormField {
  name: string;
  kind: FormFieldKind;
  label: string;
  required: boolean;
  options?: string[];
}

function collectInputRefs(effects: ActionEffect[]): Set<string> {
  const names = new Set<string>();
  const scan = (v: unknown): void => {
    if (typeof v === "string" && v.startsWith("$inputs.")) {
      names.add(v.slice("$inputs.".length));
      return;
    }
    if (v && typeof v === "object") {
      if (!Array.isArray(v) && "$input" in (v as Record<string, unknown>)) {
        const k = (v as Record<string, unknown>).$input;
        if (typeof k === "string") names.add(k);
        return;
      }
      for (const child of Object.values(v as Record<string, unknown>)) scan(child);
    }
  };
  for (const e of effects) {
    scan(e.property);
    scan(e.value);
    scan(e.linkKey);
    scan(e.targetId);
    scan(e.typeKey);
    scan(e.data);
  }
  return names;
}

function guessKind(name: string): FormFieldKind {
  const lower = name.toLowerCase();
  if (lower.includes("id") && !lower.includes("valid")) return "object";
  if (/(miles|qty|quantity|amount|revenue|count|point|stock|rate|fee|price)/.test(lower)) return "number";
  if (/(reason|note|comment|description)/.test(lower)) return "textarea";
  if (lower === "status" || lower === "stage") return "select";
  return "text";
}

export function describeActionForm(def: ActionDef): FormField[] {
  return [...collectInputRefs(def.effects)].sort().map((name) => ({
    name,
    kind: guessKind(name),
    label: name.replace(/([A-Z])/g, " $1").replace(/[_-]+/g, " ").trim(),
    required: true,
  }));
}

export function validateActionInputs(
  def: ActionDef,
  inputs: Record<string, unknown>,
): { ok: boolean; errors: Array<{ field: string; message: string }> } {
  const errors: Array<{ field: string; message: string }> = [];
  for (const field of describeActionForm(def)) {
    const v = inputs[field.name];
    if (v === undefined || v === null || v === "") {
      errors.push({ field: field.name, message: `${field.label || field.name} is required` });
      continue;
    }
    if (field.kind === "number" && (typeof v !== "number" && Number.isNaN(Number(v)))) {
      errors.push({ field: field.name, message: `${field.label || field.name} must be a number` });
    }
  }
  return { ok: errors.length === 0, errors };
}
