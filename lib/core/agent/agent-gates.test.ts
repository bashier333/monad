import { describe, expect, it } from "vitest";
import {
  assertAnswerCitesObjects,
  assertNoUngroundedProposals,
  evalAnswer,
} from "@/lib/core/agent/evals";
import { renderContextForPrompt, type AgentContext } from "@/lib/core/agent/context";
import { BUILTIN_LOGIC_FNS, TOOL_SCHEMAS } from "@/lib/core/agent/tools";
import type { AgentAnswer } from "@/lib/core/agent/types";

// Agent gate proof: groundedness assertions, prompt rendering, tool
// contracts. The evals that keep hallucinations out of answers.

function answer(over: Partial<AgentAnswer> = {}): AgentAnswer {
  return {
    answer: "Coverage is [o1] and [o2].",
    steps: [],
    proposals: [
      {
        verb: "mfg_transfer_stock",
        objectId: "o1",
        objectKey: "l1",
        inputs: {},
        preview: null,
        approvalRequired: true,
        allowedRoles: ["OWNER"],
        latitude: "confirm",
        requestedBy: "u1",
        lineage: [],
      },
    ],
    citedIds: ["o1", "o2"],
    provider: "test",
    ...over,
  };
}

const CTX = ["o1", "o2"];

describe("assertAnswerCitesObjects", () => {
  it("passes cited context ids, names hallucinations", () => {
    expect(assertAnswerCitesObjects(answer(), CTX)).toMatchObject({ ok: true, missing: [] });
    const bad = assertAnswerCitesObjects(answer({ answer: "See [ghost].", citedIds: ["ghost"] }), CTX);
    expect(bad).toMatchObject({ ok: false, missing: ["ghost"] });
    expect(assertAnswerCitesObjects(answer({ citedIds: [] }), CTX).ok).toBe(false);
  });
  it("ignores non-id brackets conservatively", () => {
    const r = assertAnswerCitesObjects(answer({ answer: "No citations here.", citedIds: ["o1"] }), CTX);
    expect(r.ok).toBe(true);
  });
});

describe("assertNoUngroundedProposals", () => {
  it("rejects proposals pointing outside context", () => {
    expect(assertNoUngroundedProposals(answer(), CTX).ok).toBe(true);
    const bad = assertNoUngroundedProposals(
      answer({ proposals: [{ ...answer().proposals[0]!, objectId: "ghost" }] }),
      CTX,
    );
    expect(bad).toMatchObject({ ok: false, ungrounded: ["ghost"] });
  });
});

describe("evalAnswer", () => {
  it("combines both gates with named failures", () => {
    expect(evalAnswer(answer(), CTX)).toMatchObject({ ok: true, failures: [] });
    const bad = evalAnswer(answer({ answer: "Hi.", citedIds: [] }), CTX);
    expect(bad.ok).toBe(false);
    expect(bad.failures.join(" ")).toMatch(/cites no objects/);
  });
});

describe("renderContextForPrompt", () => {
  const ctx: AgentContext = {
    nodes: [
      { id: "o1", key: "l1", type: "mfg_inventory_lot", data: { qty_on_hand: 5 } },
      { id: "o2", key: "s1", type: "mfg_shipment", data: { status: "delayed" } },
    ],
    types: [{ key: "mfg_inventory_lot", label: "Lot", properties: ["qty_on_hand"] }],
    truncated: false,
  };
  it("renders types, citable nodes, and truncation honestly", () => {
    const out = renderContextForPrompt(ctx);
    expect(out).toContain("OBJECT TYPES:");
    expect(out).toContain("[o1] mfg_inventory_lot:l1");
    expect(out).not.toContain("showing first 400");
    const big: AgentContext = { ...ctx, nodes: Array.from({ length: 401 }, (_, i) => ({ id: `n${i}`, key: `k${i}`, type: "t", data: {} })), truncated: true };
    const out2 = renderContextForPrompt(big);
    expect(out2).toContain("showing first 400");
    expect(out2).toContain("401 objects total");
  });
});

describe("TOOL_SCHEMAS", () => {
  it("parses query/logic/action inputs with bounds", () => {
    expect(TOOL_SCHEMAS.ontology_query.safeParse({ op: "list", type: "t" }).success).toBe(true);
    expect(TOOL_SCHEMAS.ontology_query.safeParse({ op: "drop" }).success).toBe(false);
    expect(TOOL_SCHEMAS.ontology_logic.safeParse({ fn: "margin_rollup", args: {} }).success).toBe(true);
    expect(TOOL_SCHEMAS.ontology_logic.safeParse({ fn: "", args: {} }).success).toBe(false);
    expect(TOOL_SCHEMAS.ontology_logic.safeParse({ fn: "coverage_days", args: {}, depth: 99 }).success).toBe(true);
    expect(TOOL_SCHEMAS.ontology_action.safeParse({ verb: "v", objectId: "o" }).success).toBe(true);
  });
  it("builtin registry documents the four pack functions", () => {
    expect([...BUILTIN_LOGIC_FNS]).toEqual(["coverage_days", "reorder_suggestion", "fulfillment_risk", "demand_forecast"]);
  });
  it("query depth caps at 4", () => {
    expect(TOOL_SCHEMAS.ontology_query.safeParse({ op: "traverse", depth: 5 }).success).toBe(false);
    expect(TOOL_SCHEMAS.ontology_query.safeParse({ op: "traverse", depth: 4 }).success).toBe(true);
  });
});
