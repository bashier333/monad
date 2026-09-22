import { describe, expect, it } from "vitest";
import { summarizeScenarioFlow, validateEmbedUrl } from "@/lib/core/boards/widget-system";

// Embed + scenario widget proof (F2-09001+ families): embeds fail closed.
// Scenario execution proof lives in lib/packs/scenario-flow.test.ts (packs
// may import core; core never imports packs).

describe("validateEmbedUrl", () => {
  const allow = ["https://briefs.example.com", "https://maps.example.com"];
  it("allows listed https origins, rejects everything else", () => {
    expect(validateEmbedUrl("https://briefs.example.com/w/1", allow)).toMatchObject({
      ok: true,
      origin: "https://briefs.example.com",
    });
    expect(validateEmbedUrl("http://briefs.example.com/w/1", allow).ok).toBe(false);
    expect(validateEmbedUrl("https://evil.test/w", allow)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/not allowlisted/),
    });
    expect(validateEmbedUrl("not a url", allow).ok).toBe(false);
    expect(validateEmbedUrl("https://BRIEFS.example.com/w", allow).ok).toBe(true);
  });
});

describe("scenario flow shapes line up", () => {
  const changes = [{ objectId: "l1", data: { qty_on_hand: 100 } }];
  const before = { l1: { qty_on_hand: 10 } };
  const after = { l1: { qty_on_hand: 100 } };
  it("staging summary agrees with the diff", () => {
    const summary = summarizeScenarioFlow(changes, before, after);
    expect(summary).toMatchObject({ staged: 1, affectedObjects: ["l1"] });
    expect(summary.diff).toEqual([{ field: "l1", before: { qty_on_hand: 10 }, after: { qty_on_hand: 100 } }]);
  });
  it("empty scenarios summarize honestly", () => {
    expect(summarizeScenarioFlow([], {}, {})).toMatchObject({ staged: 0, diff: [], affectedObjects: [] });
  });
});
