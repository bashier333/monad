import { describe, expect, it } from "vitest";
import { PACK_PRICES, TIERS } from "@/lib/core/pricing";

describe("pricing single source (X10 E-473)", () => {
  it("tiers render from TIERS", () => {
    expect(TIERS.map((t) => t.id)).toContain("team");
  });

  it("per-pack Team prices come from PACK_PRICES", () => {
    expect(PACK_PRICES.map((p) => p.pack).sort()).toEqual(["agency", "freight"]);
    for (const p of PACK_PRICES) {
      expect(p.team).toMatch(/\$/);
      expect(p.note.length).toBeGreaterThan(0);
    }
  });
});
