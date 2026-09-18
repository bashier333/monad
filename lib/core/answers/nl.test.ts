import { parseQueryGeneric } from "@/lib/core/answers/nl";
import { describe, expect, it } from "vitest";

const TOY = {
  entityWord: "project",
  topics: [
    { topic: "losers", patterns: ["lost", "bleeding"] },
    { topic: "rework", patterns: ["rework", "revisions"] },
  ],
};

describe("parseQueryGeneric (core)", () => {
  it("routes entity drills by configured word", () => {
    expect(parseQueryGeneric("project acme", TOY)).toMatchObject({ view: "lane", lane: "acme" });
    expect(parseQueryGeneric("lane dallas", TOY).view).not.toBe("lane");
  });

  it("matches configured topics and week offsets", () => {
    expect(parseQueryGeneric("which projects are bleeding last week", TOY)).toMatchObject({
      view: "lanes",
      topic: "losers",
      weekOffset: -1,
    });
    expect(parseQueryGeneric("rework", TOY)).toMatchObject({ view: "lanes", topic: "rework" });
  });

  it("keeps shared intents pack-independent", () => {
    expect(parseQueryGeneric("upload a file", TOY)).toMatchObject({ view: "upload" });
    expect(parseQueryGeneric("monday brief", TOY)).toMatchObject({ view: "brief" });
    expect(parseQueryGeneric("help", TOY)).toMatchObject({ view: "help" });
    expect(parseQueryGeneric("something else", TOY)).toMatchObject({ view: "lanes" });
  });
});
