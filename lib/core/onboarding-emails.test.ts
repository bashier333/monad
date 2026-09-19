import { describe, expect, it } from "vitest";
import { day0Email, day3Email, day7Email } from "@/lib/core/onboarding-emails";

describe("onboarding emails (R-457)", () => {
  it("day 0/3/7 copy is value-led with links", () => {
    const d0 = day0Email("https://app");
    expect(d0.subject).toMatch(/first answer/);
    expect(d0.html).toContain("https://app/upload");
    const d3data = day3Email("https://app", true);
    expect(d3data.subject).toMatch(/worst/);
    const d3stuck = day3Email("https://app", false);
    expect(d3stuck.subject).toMatch(/mapping/);
    const d7 = day7Email("https://app");
    expect(d7.html).toContain("https://app/briefs");
  });
});
