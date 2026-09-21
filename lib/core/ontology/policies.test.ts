import { describe, expect, it } from "vitest";
import {
  analyzePolicies,
  decidePolicies,
  detectPii,
  evaluatePolicies,
  filterRows,
  maskPii,
  policyMatches,
} from "@/lib/core/ontology/policies";

describe("ontology policies (ONT-0701-0745)", () => {
  it("matches conditions", () => {
    expect(policyMatches({ effect: "allow", field: "region", op: "eq", value: "TX", priority: 1 }, { region: "TX" })).toBe(true);
    expect(policyMatches({ effect: "allow", field: "client", op: "in", value: ["a", "b"], priority: 1 }, { client: "b" })).toBe(true);
    expect(policyMatches({ effect: "allow", field: "name", op: "startsWith", value: "Ac", priority: 1 }, { name: "Acme" })).toBe(true);
    expect(policyMatches({ effect: "allow", field: "name", op: "contains", value: "xm", priority: 1 }, { name: "Acme" })).toBe(false);
  });
  it("denies by default and lets deny win", () => {
    expect(evaluatePolicies([], { region: "TX" })).toBe(false);
    const policies = [
      { effect: "allow" as const, field: "region", op: "eq" as const, value: "TX", priority: 100 },
      { effect: "deny" as const, field: "client", op: "eq" as const, value: "blocked", priority: 10 },
    ];
    expect(evaluatePolicies(policies, { region: "TX", client: "ok" })).toBe(true);
    expect(evaluatePolicies(policies, { region: "TX", client: "blocked" })).toBe(false);
    expect(evaluatePolicies(policies, { region: "CA", client: "ok" })).toBe(false);
  });
  it("filters rows to visible only", () => {
    const rows = [{ region: "TX" }, { region: "CA" }];
    expect(filterRows([{ effect: "allow", field: "region", op: "eq", value: "TX", priority: 1 }], rows)).toEqual([
      { region: "TX" },
    ]);
    expect(filterRows([], rows)).toEqual([]);
  });
});

describe("combining algebra: deny-overrides + default-deny + trace (MFG-0701)", () => {
  const allowTx = { effect: "allow" as const, field: "region", op: "eq" as const, value: "TX", priority: 100 };
  const denyBlocked = { effect: "deny" as const, field: "client", op: "eq" as const, value: "blocked", priority: 10 };
  it("deny wins regardless of priority order", () => {
    const d = decidePolicies([allowTx, denyBlocked], { region: "TX", client: "blocked" });
    expect(d.allowed).toBe(false);
    expect(d.trace.some((t) => t.verdict === "deny")).toBe(true);
    expect(d.trace.some((t) => t.verdict === "allow")).toBe(true);
  });
  it("same-priority allow vs deny resolves to deny deterministically", () => {
    const d = decidePolicies(
      [
        { effect: "allow" as const, field: "a", op: "eq" as const, value: 1, priority: 5 },
        { effect: "deny" as const, field: "b", op: "eq" as const, value: 2, priority: 5 },
      ],
      { a: 1, b: 2 }
    );
    expect(d.allowed).toBe(false);
    expect(d.trace.filter((t) => t.verdict !== "not-applicable").map((t) => t.effect)).toEqual(["deny", "allow"]);
  });
  it("distinguishes not-applicable from deny in the trace", () => {
    const d = decidePolicies([allowTx], { region: "CA" });
    expect(d.allowed).toBe(false);
    expect(d.trace).toEqual([
      { index: 0, effect: "allow", field: "region", op: "eq", priority: 100, verdict: "not-applicable" },
    ]);
  });
  it("detects duplicates and shadowed allows", () => {
    const dup = analyzePolicies([allowTx, { ...allowTx }]);
    expect(dup.some((f) => f.startsWith("duplicate"))).toBe(true);
    const shadow = analyzePolicies([
      allowTx,
      { effect: "deny" as const, field: "region", op: "eq" as const, value: "TX", priority: 100 },
    ]);
    expect(shadow.some((f) => f.includes("shadowed"))).toBe(true);
    expect(analyzePolicies([allowTx, denyBlocked])).toEqual([]);
  });
});

describe("ontology PII (ONT-0746-0765)", () => {
  it("detects and masks emails and phones", () => {
    expect(detectPii("mail bob@acme.co today")).toEqual(["email"]);
    expect(detectPii("+1 312 555 0100")).toContain("phone");
    expect(maskPii("mail bob@acme.co or +1 312 555 0100")).toBe("mail [email] or [phone]");
    expect(detectPii("nothing here")).toEqual([]);
  });
});
