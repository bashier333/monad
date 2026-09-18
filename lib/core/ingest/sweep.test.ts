import { isStaleRun, STALE_MS } from "@/lib/core/ingest/pipeline";
import { describe, expect, it } from "vitest";

describe("stale-run sweep (B-090)", () => {
  it("flags runs stuck longer than 30 minutes", () => {
    const now = Date.now();
    expect(isStaleRun(new Date(now - STALE_MS - 1000), now)).toBe(true);
    expect(isStaleRun(new Date(now - STALE_MS + 60_000), now)).toBe(false);
  });
});
