import { describe, expect, it } from "vitest";
import { assertAnswerCitesObjects, assertNoUngroundedProposals } from "@/lib/core/agent/evals";

// Groundedness assertions are pure functions over answers: no provider
// involved, so they need no doubles. The live tool loop is covered by the
// evals route (live provider, on demand) and scripts/agent-live-check.ts.
describe("agent evals (MFG-0502)", () => {
  it("flags answers that cite unknown ids", () => {
    const r = assertAnswerCitesObjects(
      { answer: "see [ghost-9]", steps: [], proposals: [], citedIds: ["sh-1"], provider: "nvidia" },
      ["sh-1"]
    );
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(["ghost-9"]);
  });

  it("flags ungrounded proposals", () => {
    const r = assertNoUngroundedProposals(
      {
        answer: "",
        steps: [],
        proposals: [
          { verb: "mfg_transfer_stock", objectId: "ghost-9", objectKey: "", inputs: {}, preview: null, approvalRequired: true, allowedRoles: ["OWNER"], latitude: "confirm", requestedBy: "user-1", lineage: [] },
        ],
        citedIds: [],
        provider: "nvidia",
      },
      ["sh-1"]
    );
    expect(r.ok).toBe(false);
    expect(r.ungrounded).toEqual(["ghost-9"]);
  });
});
