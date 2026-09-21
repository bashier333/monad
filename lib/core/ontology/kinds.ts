export const PROPERTY_KINDS = [
  "string",
  "number",
  "boolean",
  "date",
  "datetime",
  "enum",
  "reference",
  "multi_reference",
  "geo",
  "file",
  "currency",
  "percent",
  "duration",
  "phone",
  "email",
  "url",
  "json",
  "computed",
  "integer",
  "text",
] as const;

export type PropertyKind = (typeof PROPERTY_KINDS)[number];

export interface CoerceResult {
  ok: boolean;
  value?: unknown;
  error?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const PHONE_RE = /^[+()\-.\s\d]{7,24}$/;

function num(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function coerceValue(kind: PropertyKind, raw: unknown, config?: Record<string, unknown>): CoerceResult {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: null };
  switch (kind) {
    case "string":
    case "text": {
      const s = String(raw);
      const min = typeof config?.minLength === "number" ? config.minLength : 0;
      const max = typeof config?.maxLength === "number" ? config.maxLength : 5000;
      if (s.length < min) return { ok: false, error: `shorter than minLength ${min}` };
      if (s.length > max) return { ok: false, error: `longer than maxLength ${max}` };
      if (typeof config?.pattern === "string" && !new RegExp(config.pattern).test(s)) {
        return { ok: false, error: "does not match pattern" };
      }
      return { ok: true, value: s };
    }
    case "number":
    case "currency": {
      const n = num(raw);
      if (n === null) return { ok: false, error: "not a number" };
      if (typeof config?.min === "number" && n < config.min) return { ok: false, error: `below min ${config.min}` };
      if (typeof config?.max === "number" && n > config.max) return { ok: false, error: `above max ${config.max}` };
      return { ok: true, value: n };
    }
    case "integer": {
      const n = num(raw);
      if (n === null || !Number.isInteger(n)) return { ok: false, error: "not an integer" };
      return { ok: true, value: n };
    }
    case "percent": {
      const n = num(raw);
      if (n === null) return { ok: false, error: "not a number" };
      if (n < 0 || n > 100) return { ok: false, error: "percent out of 0-100 range" };
      return { ok: true, value: n };
    }
    case "boolean": {
      if (typeof raw === "boolean") return { ok: true, value: raw };
      if (raw === "true" || raw === 1) return { ok: true, value: true };
      if (raw === "false" || raw === 0) return { ok: true, value: false };
      return { ok: false, error: "not a boolean" };
    }
    case "date":
    case "datetime": {
      const d = raw instanceof Date ? raw : new Date(String(raw));
      if (Number.isNaN(d.getTime())) return { ok: false, error: "not a date" };
      return { ok: true, value: kind === "date" ? d.toISOString().slice(0, 10) : d.toISOString() };
    }
    case "enum": {
      const options = Array.isArray(config?.options) ? (config.options as unknown[]) : [];
      if (!options.includes(raw)) return { ok: false, error: `not one of: ${options.join(", ")}` };
      return { ok: true, value: raw };
    }
    case "reference": {
      const s = String(raw);
      if (!s) return { ok: false, error: "empty reference" };
      return { ok: true, value: s };
    }
    case "multi_reference": {
      const arr = Array.isArray(raw) ? raw : [raw];
      if (typeof config?.maxCount === "number" && arr.length > config.maxCount) {
        return { ok: false, error: `more than maxCount ${config.maxCount}` };
      }
      return { ok: true, value: arr.map(String) };
    }
    case "geo": {
      const o = raw as Record<string, unknown>;
      const lat = num(o?.lat);
      const lng = num(o?.lng);
      if (lat === null || lng === null) return { ok: false, error: "geo needs lat/lng numbers" };
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return { ok: false, error: "geo out of bounds" };
      return { ok: true, value: { lat, lng } };
    }
    case "file": {
      const s = String(raw);
      const allow = Array.isArray(config?.mimeAllowlist) ? (config.mimeAllowlist as string[]) : null;
      if (allow && !allow.some((m) => s.startsWith(m.split("/")[0]))) {
        return { ok: false, error: "mime not allowlisted" };
      }
      return { ok: true, value: s };
    }
    case "duration": {
      const n = num(raw);
      if (n === null || n < 0) return { ok: false, error: "duration must be a non-negative number" };
      return { ok: true, value: n };
    }
    case "phone":
      return PHONE_RE.test(String(raw)) ? { ok: true, value: String(raw) } : { ok: false, error: "bad phone format" };
    case "email":
      return EMAIL_RE.test(String(raw)) ? { ok: true, value: String(raw) } : { ok: false, error: "bad email format" };
    case "url":
      return URL_RE.test(String(raw)) ? { ok: true, value: String(raw) } : { ok: false, error: "bad url format" };
    case "json":
      return { ok: true, value: raw };
    case "computed":
      return { ok: false, error: "computed properties are read-only" };
    default:
      return { ok: false, error: `unknown kind ${(kind as string) ?? "?"}` };
  }
}

export function validateKindConfig(kind: PropertyKind, config?: Record<string, unknown>): string[] {
  const problems: string[] = [];
  if (kind === "enum" && !Array.isArray(config?.options)) problems.push("enum requires config.options array");
  if (kind === "string" || kind === "text") {
    if (config?.minLength !== undefined && typeof config.minLength !== "number") problems.push("minLength must be a number");
    if (config?.maxLength !== undefined && typeof config.maxLength !== "number") problems.push("maxLength must be a number");
  }
  return problems;
}
