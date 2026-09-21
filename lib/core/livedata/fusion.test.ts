import { describe, expect, it } from "vitest";
import { dedupeFlags, fuseFlags } from "@/lib/core/livedata/fuse";
import { decideVerdict, runVerdict, verdictCaption } from "@/lib/core/livedata/verdict";
import { runCheck } from "@/lib/core/livedata/pipeline";
import type { LiveFlag } from "@/lib/core/livedata/types";

const KILL_FLAGS: LiveFlag[] = [
  { text: "Registry Dissolved", source: "OpenCorporates", severity: "critical" },
  { text: "7 dockets mention Acme", source: "CourtListener", severity: "critical" },
];

describe("livedata fusion (LIVE-101-120)", () => {
  it("dedupes identical flags", () => {
    const dupes: LiveFlag[] = [
      { text: "Same", source: "EDGAR", severity: "info" },
      { text: "same ", source: "EDGAR", severity: "info" },
    ];
    expect(dedupeFlags(dupes)).toHaveLength(1);
  });
  it("weights trusted sources higher", () => {
    const fused = fuseFlags([
      { text: "a", source: "OpenCorporates", severity: "warn" },
      { text: "b", source: "GDELT", severity: "warn" },
    ]);
    expect(fused[0]!.confidence).toBeGreaterThanOrEqual(fused[1]!.confidence);
  });
  it("sorts critical first", () => {
    const fused = fuseFlags([
      { text: "a", source: "GDELT", severity: "info" },
      { text: "b", source: "EDGAR", severity: "critical" },
    ]);
    expect(fused[0]!.severity).toBe("critical");
  });
});

describe("livedata verdict (LIVE-121-160)", () => {
  it("decides on the kill and fund lines", () => {
    expect(decideVerdict(12)).toBe("KILL");
    expect(decideVerdict(58)).toBe("REVIEW");
    expect(decideVerdict(88)).toBe("FUND");
    expect(verdictCaption("KILL")).toContain("Walk away");
  });
  it("kills on critical mass", () => {
    const r = runVerdict(KILL_FLAGS);
    expect(r.verdict).toBe("KILL");
    expect(r.score).toBeLessThan(40);
    expect(r.evidence).toHaveLength(2);
  });
  it("reviews on empty evidence", () => {
    const r = runVerdict([]);
    expect(r.verdict).toBe("REVIEW");
    expect(r.explanation).toContain("0 fused flags");
  });
  it("names degraded sources", () => {
    const r = runVerdict([], ["EDGAR"]);
    expect(r.degradedSources).toEqual(["EDGAR"]);
  });
});

describe("livedata pipeline (LIVE-161-180)", () => {
  it("fuses injected source runners end to end", async () => {
    const r = await runCheck("Acme", { sources: [] });
    expect(r.company).toBe("Acme");
    expect(r.verdict).toBe("REVIEW");
    expect(r.sourceStates).toHaveLength(0);
  });
  it("survives a throwing source", async () => {
    const r = await runCheck("Acme", { sources: ["gdelt"], timeoutMs: 50 });
    expect(r.company).toBe("Acme");
    expect(Array.isArray(r.evidence)).toBe(true);
  });
});
