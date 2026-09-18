import { describe, expect, it } from "vitest";
import { AGENCY_NL, parseAgencyQuery } from "@/lib/packs/agency/nl";
import { FREIGHT_NL, parseQuery } from "@/lib/packs/freight/nl";

describe("cross-pack NL routing (X9 E-421)", () => {
  it("pack-specific topic patterns do not collide (shared losers/winners are intentional)", () => {
    const core = new Set(["losers", "winners"]);
    const freightSpecific = new Set(
      FREIGHT_NL.topics.filter((t) => !core.has(t.topic)).flatMap((t) => t.patterns),
    );
    const agencySpecific = new Set(
      AGENCY_NL.topics.filter((t) => !core.has(t.topic)).flatMap((t) => t.patterns),
    );
    const shared = [...freightSpecific].filter((p) => agencySpecific.has(p));
    expect(shared).toEqual([]);
  });

  it("each pack degrades gracefully on the other's queries (never throws, never blank)", () => {
    expect(parseQuery("rework cost").view).toBe("lanes");
    expect(parseAgencyQuery("fuel spend").view).toBe("lanes");
    expect(parseQuery("project acme site")).toEqual({ view: "lanes", weekOffset: 0 });
  });

  it("entity words route drill-downs to the right pack shape", () => {
    expect(parseQuery("lane dallas houston")).toMatchObject({ view: "lane" });
    expect(parseAgencyQuery("project acme site")).toMatchObject({ view: "lane", lane: "acme site" });
  });
});
