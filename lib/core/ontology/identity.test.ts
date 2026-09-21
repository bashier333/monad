import { describe, expect, it } from "vitest";
import {
  applyMergePlan,
  applyUnmerge,
  AUTO_MERGE_THRESHOLD,
  classifyMatch,
  normalizeKey,
  normalizeName,
  planMerge,
  proposeMerge,
  REVIEW_THRESHOLD,
  scoreFields,
  scoreMatch,
  stableObjectKey,
} from "@/lib/core/ontology/identity";

describe("ontology identity (ONT-0111-0130)", () => {
  it("normalizes keys and names", () => {
    expect(normalizeKey("  Acme, Inc. ")).toBe("acme_inc");
    expect(normalizeName("ACME   Inc.")).toBe("acme inc");
    expect(stableObjectKey("lane", "Dallas TX")).toBe("lane:dallas_tx");
  });
  it("scores exact, near, and token matches", () => {
    expect(scoreMatch("Acme Inc", "acme inc").score).toBe(1);
    expect(scoreMatch("Acme Inc", "Acme Ink").score).toBeGreaterThanOrEqual(0.85);
    expect(scoreMatch("Dallas Fort Worth", "dallas airport").score).toBeLessThan(0.6);
  });
  it("plans merges preferring non-empty fields", () => {
    const plan = planMerge(
      { id: "s", data: { name: "Acme", phone: "" } },
      { id: "l", data: { name: "Acme", phone: "555" } }
    );
    expect(plan.fieldPicks).toEqual([{ field: "phone", winner: "loser" }]);
    expect(plan.aliasLoserKey).toBe(true);
  });
  it("blends weighted multi-field scores and classifies (MFG-0201)", () => {
    expect(AUTO_MERGE_THRESHOLD).toBeGreaterThan(REVIEW_THRESHOLD);
    const scored = scoreFields(
      { name: "Acme Inc", city: "Dallas", phone: "555-0100" },
      { name: "Acme Ink", city: "Dallas", phone: "" },
      { name: 3, city: 1, phone: 2 }
    );
    expect(scored.perField.map((f) => f.field).sort()).toEqual(["city", "name"]);
    expect(scored.score).toBeGreaterThanOrEqual(0.7);
    expect(classifyMatch(1)).toBe("auto");
    expect(classifyMatch(0.8)).toBe("review");
    expect(classifyMatch(0.5)).toBe("no-match");
    expect(classifyMatch(AUTO_MERGE_THRESHOLD)).toBe("auto");
    expect(classifyMatch(REVIEW_THRESHOLD)).toBe("review");
  });
  it("proposes review records with snapshots and unmerges (MFG-0202)", () => {
    const survivor = { id: "s", data: { name: "Acme Inc", city: "Dallas" } };
    const loser = { id: "l", data: { name: "Acme Ink", city: "Dallas" } };
    const review = proposeMerge(survivor, loser, { name: 3, city: 1 });
    expect(review).not.toBeNull();
    expect(review!.actionKey).toBe("identity.merge.review");
    expect(review!.survivorSnapshot).toEqual(survivor.data);
    expect(review!.loserSnapshot).toEqual(loser.data);
    expect(review!.plan.survivorId).toBe("s");
    const restored = applyUnmerge(review!);
    expect(restored.survivor).toEqual(survivor.data);
    expect(restored.loser).toEqual(loser.data);
    expect(
      proposeMerge(
        { id: "s", data: { name: "Acme" } },
        { id: "l", data: { name: "Zebra" } },
        { name: 1 }
      )
    ).toBeNull();
  });
  it("applies merge plans", () => {
    const out = applyMergePlan({ phone: "" }, { phone: "555" }, {
      survivorId: "s",
      loserId: "l",
      fieldPicks: [{ field: "phone", winner: "loser" }],
      aliasLoserKey: true,
    });
    expect(out).toEqual({ phone: "555" });
  });
});
