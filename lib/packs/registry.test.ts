import { describe, expect, it } from "vitest";
import { validatePackManifest } from "@/lib/packs/manifest";
import { FREIGHT_MANIFEST } from "@/lib/packs/freight/manifest";
import { AGENCY_MANIFEST } from "@/lib/packs/agency/manifest";
import { packManifests } from "@/lib/packs/register";

describe("pack registry (X7 E-301–303/E-307)", () => {
  it("both manifests validate", () => {
    expect(validatePackManifest(FREIGHT_MANIFEST)).toEqual([]);
    expect(validatePackManifest(AGENCY_MANIFEST)).toEqual([]);
    expect(packManifests().map((m) => m.id).sort()).toEqual(["agency", "freight"]);
  });

  it("rejects invalid declarations with reasons", () => {
    expect(
      validatePackManifest({ id: "Bad ID", name: "", version: 0, entities: [], sources: [], vocabulary: {}, migrationNotes: [] }),
    ).toEqual([
      "id must be slug-case: Bad ID",
      "name is required",
      "version must be a positive integer",
      "at least one entity required",
      "at least one source required",
      "vocabulary.group is required",
    ]);
  });

  it("agency manifest matches its ontology", () => {
    expect(AGENCY_MANIFEST.sources).toContain("feedback");
    expect(AGENCY_MANIFEST.vocabulary.group).toBe("project");
  });
});
