import { FREIGHT_ONTOLOGY, validateOntology } from "@/lib/packs/freight/ontology";
import { PRESETS } from "@/lib/core/ingest/presets";
import { describe, expect, it } from "vitest";

describe("freight ontology declaration (X2)", () => {
  it("validates against code reality", () => {
    expect(validateOntology(FREIGHT_ONTOLOGY)).toEqual([]);
  });

  it("every preset vendor exists in the preset registry", () => {
    const vendors = PRESETS.map((p) => p.vendor);
    for (const v of FREIGHT_ONTOLOGY.presets) {
      expect(vendors).toContain(v);
    }
  });

  it("declares the NL topics the parser supports", () => {
    expect(FREIGHT_ONTOLOGY.nlTopics).toContain("losers");
    expect(FREIGHT_ONTOLOGY.nlEntityWord).toBe("lane");
  });
});
