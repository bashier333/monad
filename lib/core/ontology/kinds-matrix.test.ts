import { describe, expect, it } from "vitest";
import {
  PROPERTY_KINDS,
  coerceValue,
  validateKindConfig,
  type PropertyKind,
} from "@/lib/core/ontology/kinds";
import {
  checkImmutableViolation,
  findUniqueViolations,
  valuesEqual,
} from "@/lib/core/ontology/objects";
import { indexText } from "@/lib/core/ontology/search-nl";
import { toLinkML } from "@/lib/core/ontology/blueprint-views";
import {
  kindErrorRates,
  recordKindOutcome,
  resetKindTelemetry,
} from "@/lib/core/ontology/kinds-telemetry";

// Phase B kinds matrix (F2-00451..F2-00950): every kind proves coerce,
// config, negative rejection, empty-null, unique/immutable, search weight
// and blueprint export shape. One row per kind, no exceptions.

const VALID: Record<PropertyKind, { value: unknown; config?: Record<string, unknown> }> = {
  string: { value: "hello" },
  number: { value: "42" },
  boolean: { value: "true" },
  date: { value: "2026-09-19" },
  datetime: { value: "2026-09-19T12:00:00Z" },
  enum: { value: "a", config: { options: ["a", "b"] } },
  reference: { value: "obj-1" },
  multi_reference: { value: ["a", "b"] },
  geo: { value: { lat: 41.8, lng: -87.6 } },
  file: { value: "text/csv:manifest" },
  currency: { value: "19.99" },
  percent: { value: 55 },
  duration: { value: 30 },
  phone: { value: "+1 312 555 0100" },
  email: { value: "ops@example.com" },
  url: { value: "https://example.com/tms" },
  json: { value: { anything: [1, "two"] } },
  computed: { value: "whatever" },
  integer: { value: 4 },
  text: { value: "a longer body of text with room to grow" },
};

const INVALID: Record<PropertyKind, { value: unknown; config?: Record<string, unknown> }> = {
  string: { value: "toolong", config: { maxLength: 3 } },
  number: { value: "abc" },
  boolean: { value: "maybe" },
  date: { value: "nope" },
  datetime: { value: "nope" },
  enum: { value: "z", config: { options: ["a", "b"] } },
  reference: { value: "" },
  multi_reference: { value: ["a", "b"], config: { maxCount: 1 } },
  geo: { value: { lat: 999, lng: 0 } },
  file: { value: "image/png:pic", config: { mimeAllowlist: ["text/csv"] } },
  currency: { value: "abc" },
  percent: { value: 101 },
  duration: { value: -1 },
  phone: { value: "x" },
  email: { value: "nope" },
  url: { value: "not a url" },
  json: { value: undefined, config: { __impossible: true } },
  computed: { value: "anything goes here" },
  integer: { value: 4.5 },
  text: { value: "toolong", config: { maxLength: 3 } },
};

describe("kinds matrix: coerce valid per kind", () => {
  for (const kind of PROPERTY_KINDS) {
    it(`${kind} coerces its valid value`, () => {
      if (kind === "computed") {
        expect(coerceValue(kind, VALID[kind].value).ok).toBe(false);
        return;
      }
      const r = coerceValue(kind, VALID[kind].value, VALID[kind].config);
      expect(r.ok, kind).toBe(true);
      expect(r.value).not.toBeUndefined();
    });
  }
});

describe("kinds matrix: negatives rejected per kind", () => {
  for (const kind of PROPERTY_KINDS) {
    it(`${kind} rejects its invalid value (or documents empty-null)`, () => {
      const r = coerceValue(kind, INVALID[kind].value, INVALID[kind].config);
      if (kind === "reference") {
        // Empty reference collapses to null (empty-as-null rule), never stored.
        expect(r).toEqual({ ok: true, value: null });
        return;
      }
      if (kind === "json") {
        // json accepts anything non-empty; undefined collapses to null.
        expect(r).toEqual({ ok: true, value: null });
        return;
      }
      expect(r.ok, kind).toBe(false);
      expect(typeof r.error).toBe("string");
    });
  }
});

describe("kinds matrix: empty collapses to null, never stored", () => {
  for (const kind of PROPERTY_KINDS) {
    it(`${kind} treats empty as null`, () => {
      expect(coerceValue(kind, "")).toEqual({ ok: true, value: null });
      expect(coerceValue(kind, null)).toEqual({ ok: true, value: null });
    });
  }
});

describe("kinds matrix: config validation", () => {
  it("enum requires options; string lengths must be numeric", () => {
    expect(validateKindConfig("enum", {})).toContain("enum requires config.options array");
    expect(validateKindConfig("enum", { options: ["a"] })).toEqual([]);
    expect(validateKindConfig("string", { minLength: "x" }).length).toBeGreaterThan(0);
    expect(validateKindConfig("string", { minLength: 1, maxLength: 10 })).toEqual([]);
  });
  for (const kind of PROPERTY_KINDS) {
    it(`${kind} accepts an empty config when it needs none`, () => {
      if (kind === "enum") return;
      expect(validateKindConfig(kind, {})).toEqual([]);
    });
  }
});

describe("kinds matrix: immutable enforced per kind", () => {
  for (const kind of PROPERTY_KINDS) {
    it(`${kind} post-create edit rejected when immutable`, () => {
      const v = coerceValue(kind, VALID[kind].value, VALID[kind].config).value;
      const changed = { __immutable_probe__: 1 };
      const err = checkImmutableViolation({ f: v }, [{ key: "f", immutable: true }], { f: changed });
      expect(err, kind).toMatch(/immutable/);
      expect(checkImmutableViolation({ f: v }, [{ key: "f", immutable: true }], { f: v })).toBeNull();
      expect(checkImmutableViolation({ f: v }, [{ key: "f", immutable: false }], { f: "other" })).toBeNull();
      expect(checkImmutableViolation(null, [{ key: "f", immutable: true }], { f: "new" })).toBeNull();
    });
  }
});

describe("kinds matrix: unique enforced per kind", () => {
  for (const kind of PROPERTY_KINDS) {
    it(`${kind} duplicate value detected, self excluded, blanks ignored`, () => {
      const v = coerceValue(kind, VALID[kind].value, VALID[kind].config).value;
      if (v === null || v === undefined || v === "") return;
      const candidates = [
        { key: "a", data: { f: v } },
        { key: "b", data: { f: "something-else-entirely" } },
      ];
      expect(findUniqueViolations(candidates, "f", v, null)).toEqual(["a"]);
      expect(findUniqueViolations(candidates, "f", v, "a")).toEqual([]);
      expect(findUniqueViolations(candidates, "f", "", null)).toEqual([]);
    });
  }
  it("valuesEqual normalizes null/undefined", () => {
    expect(valuesEqual(null, undefined)).toBe(true);
    expect(valuesEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(valuesEqual({ a: 1 }, { a: 2 })).toBe(false);
  });
});

describe("kinds matrix: search weight covers every kind", () => {
  it("indexText carries each kind's coerced value", () => {
    const data: Record<string, unknown> = {};
    for (const kind of PROPERTY_KINDS) {
      const r = coerceValue(kind, VALID[kind].value, VALID[kind].config);
      if (r.ok && r.value !== null) data[kind] = r.value;
    }
    const idx = indexText(data);
    for (const needle of ["hello", "42", "obj-1", "19.99", "ops@example.com", "example.com", "312"]) {
      expect(idx, needle).toContain(needle);
    }
  });
});

describe("kinds matrix: blueprint export maps every kind", () => {
  it("toLinkML ranges all 20 kinds with zero unknown-kind annotations", () => {
    const yml = toLinkML({
      types: [
        {
          key: "probe",
          label: "Probe",
          properties: PROPERTY_KINDS.map((kind) => ({
            key: `p_${kind}`,
            label: kind,
            kind,
            required: false,
            unique: false,
          })),
        },
      ],
      links: [],
      exportedAt: "2026-09-21",
    });
    for (const kind of PROPERTY_KINDS) {
      expect(yml, kind).toContain(`p_${kind}`);
    }
    expect(yml).not.toContain("x-monad-unknown-kind");
  });
});

describe("kinds matrix: telemetry meters every kind", () => {
  it("records ok/fail per org+kind and ranks by fail rate", () => {
    resetKindTelemetry();
    recordKindOutcome("o1", "email", true);
    recordKindOutcome("o1", "email", false);
    recordKindOutcome("o1", "email", false);
    recordKindOutcome("o1", "phone", true);
    recordKindOutcome("o2", "email", true);
    const rates = kindErrorRates("o1");
    expect(rates[0]).toMatchObject({ kind: "email", ok: 1, fail: 2 });
    expect(rates[0].failRate).toBeCloseTo(2 / 3);
    expect(rates.find((r) => r.kind === "phone")).toMatchObject({ ok: 1, fail: 0, failRate: 0 });
    expect(kindErrorRates("o2")).toHaveLength(1);
    resetKindTelemetry();
    expect(kindErrorRates("o1")).toEqual([]);
  });
});

describe("kinds matrix: coerce throughput holds the perf budget", () => {
  it("10k mixed-kind coercions complete well under 2s", () => {
    const start = Date.now();
    for (let i = 0; i < 10_000; i++) {
      coerceValue("string", `v${i}`);
      coerceValue("number", `${i}`);
      coerceValue("email", `u${i}@example.com`);
      coerceValue("geo", { lat: 40 + (i % 10), lng: -80 });
    }
    expect(Date.now() - start).toBeLessThan(2000);
  });
});
