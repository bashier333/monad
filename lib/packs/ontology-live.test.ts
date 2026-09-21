import { describe, expect, it } from "vitest";
import { constantModel, modelsEqual } from "@/lib/packs/ontology-live";

describe("pack live adapter (ONT-0901-0935)", () => {
  it("exposes constant models for both packs", () => {
    const freight = constantModel("freight");
    expect(freight.source).toBe("constant");
    expect(freight.entities).toContain("load");
    expect(freight.entities).toContain("lane");
    expect(freight.measures.map((m) => m.name)).toContain("margin");
    const agency = constantModel("agency");
    expect(agency.entities).toContain("project");
    expect(agency.entities).toContain("approval");
  });
  it("detects model drift", () => {
    const a = constantModel("freight");
    const b = { ...constantModel("freight"), entities: ["load"] };
    expect(modelsEqual(a, b).length).toBeGreaterThan(0);
    expect(modelsEqual(a, constantModel("freight"))).toEqual([]);
  });
  it("live reads stay off by default", async () => {
    const { liveReadsEnabled } = await import("@/lib/packs/ontology-live");
    expect(liveReadsEnabled()).toBe(false);
  });
});
