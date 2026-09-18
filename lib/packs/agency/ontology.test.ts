import { AGENCY_ONTOLOGY, validateAgencyOntology } from "@/lib/packs/agency/ontology";
import { PRESETS } from "@/lib/core/ingest/presets";
import { describe, expect, it } from "vitest";

describe("agency ontology declaration (X3)", () => {
  it("validates against code reality", () => {
    expect(validateAgencyOntology(AGENCY_ONTOLOGY)).toEqual([]);
  });

  it("uses agency vocabulary, not freight words", () => {
    expect(AGENCY_ONTOLOGY.vocabulary).toMatchObject({ group: "project", records: "revisions" });
    expect(JSON.stringify(AGENCY_ONTOLOGY)).not.toMatch(/lane|truck|detention/i);
  });

  it("declares sources the ingest layer understands", () => {
    expect(AGENCY_ONTOLOGY.sources.map((s) => s.type)).toEqual([
      "time",
      "revision",
      "approval",
      "invoice",
      "asset",
      "rate",
      "project",
      "feedback",
    ]);
    void PRESETS;
  });
});
