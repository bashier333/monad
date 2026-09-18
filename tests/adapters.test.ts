import { describe, expect, it } from "vitest";
import "@/lib/packs/register";
import { getAdapter, registeredSourceTypes } from "@/lib/core/ingest/adapters";

describe("pack adapters (X4)", () => {
  it("registers all 9 source types", () => {
    const types = registeredSourceTypes();
    for (const t of ["tms", "fuel", "broker", "manual", "time", "revision", "invoice", "asset", "rate"]) {
      expect(types).toContain(t);
    }
  });

  it("unknown sourceType resolves to null", () => {
    expect(getAdapter("carrier-pigeon")).toBeNull();
  });

  it("freight adapter detects canonical columns", () => {
    const a = getAdapter("tms")!;
    const s = a.detect(["Load #", "Pickup Date", "From", "To", "Linehaul", "Miles"]);
    expect(s.mapping.loadId).toBe(0);
    expect(s.mapping.date).toBe(1);
    expect(s.mapping.revenue).toBe(4);
    expect(s.mapping.miles).toBe(5);
  });

  it("freight adapter validates + keys + dates a row", () => {
    const a = getAdapter("fuel")!;
    const seen = new Set<string>();
    const rec = { loadId: "L1", date: "2026-01-05", revenue: "1200", miles: "300", truck: "T1", amount: "200", station: "Pilot" } as Record<string, string>;
    expect(a.validate(rec, seen, "fuel")).toEqual([]);
    expect(a.loadKey(rec)).toBe("L1");
    expect(a.dateOf?.(rec)).toBe("2026-01-05");
  });

  it("agency adapter detects harvest-style time headers", () => {
    const a = getAdapter("time")!;
    const s = a.detect(["Date", "Client", "Project", "Task", "Hours", "Person"]);
    expect(s.mapping.date).toBe(0);
    expect(s.mapping.project).toBe(2);
    expect(s.mapping.hours).toBe(4);
  });

  it("agency adapter validates + keys a time row end to end", () => {
    const a = getAdapter("time")!;
    const headers = ["Date", "Client", "Project", "Task", "Hours", "Person"];
    const rows = [["2026-02-01", "Acme", "Launch", "Edit", "6", "Maya"]];
    const mapped = a.apply(headers, rows, a.detect(headers).mapping);
    expect(mapped).toHaveLength(1);
    const seen = new Set<string>();
    expect(a.validate(mapped[0].record, seen, "time")).toEqual([]);
    expect(a.loadKey(mapped[0].record)).toContain("LAUNCH");
    expect(a.dateOf?.(mapped[0].record)).toBe("2026-02-01");
  });

  it("agency adapter rejects bad invoice row", () => {
    const a = getAdapter("invoice")!;
    const seen = new Set<string>();
    const rec = { project: "", amount: "abc" } as Record<string, string>;
    const issues = a.validate(rec, seen, "invoice");
    expect(issues.some((i) => i.code === "REQUIRED")).toBe(true);
    expect(issues.some((i) => i.code === "INVALID_NUMBER")).toBe(true);
  });
});
