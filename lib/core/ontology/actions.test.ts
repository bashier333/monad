import { describe, expect, it } from "vitest";
import {
  applySetEffects,
  dryRunSet,
  isExpired,
  quorumReached,
  validateActionDef,
} from "@/lib/core/ontology/actions";

describe("ontology actions (ONT-0501-0520)", () => {
  const def = {
    key: "dispute_fee",
    label: "Dispute fee",
    targetTypeKey: "freight_load",
    inputs: {},
    effects: [{ kind: "set", property: "status", value: "disputed" }],
    approvalPolicy: "single",
    requiredCount: 1,
  };
  it("validates definitions", () => {
    expect(validateActionDef(def).ok).toBe(true);
    expect(validateActionDef({ ...def, effects: [{ kind: "set" }] }).ok).toBe(false);
    expect(validateActionDef({ ...def, effects: [{ kind: "link" }] }).ok).toBe(false);
    expect(validateActionDef({ ...def, approvalPolicy: "none", requiredCount: 3 }).ok).toBe(false);
  });
  it("dry-runs and applies set effects", () => {
    const changes = dryRunSet({ status: "open" }, [{ kind: "set", property: "status", value: "disputed" }]);
    expect(changes).toEqual([{ effect: "set status", before: "open", after: "disputed" }]);
    expect(applySetEffects({ status: "open" }, [{ kind: "set", property: "status", value: "disputed" }])).toEqual({
      status: "disputed",
    });
  });
  it("describes link effects", () => {
    const changes = dryRunSet({}, [{ kind: "link", linkKey: "load_driver", targetId: "d1" }]);
    expect(changes[0]!.effect).toBe("link load_driver -> d1");
  });
});

describe("ontology approvals (ONT-0521-0545)", () => {
  it("counts distinct approvers toward quorum", () => {
    expect(quorumReached(["u1", "u2"], 2)).toBe(true);
    expect(quorumReached(["u1", "u1"], 2)).toBe(false);
    expect(quorumReached(["u1"], 1)).toBe(true);
  });
  it("detects expiry", () => {
    expect(isExpired(null)).toBe(false);
    expect(isExpired("2020-01-01")).toBe(true);
    expect(isExpired("2999-01-01")).toBe(false);
  });
});
