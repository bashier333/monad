import { describe, expect, it } from "vitest";
import { executeFunctionSpec } from "@/lib/core/ontology/functions";
import { summarizeScenarioFlow } from "@/lib/core/boards/widget-system";
import { BUILTIN_FUNCTION_SPECS, EXTENDED_FUNCTION_SPECS } from "@/lib/packs/function-specs";
import { allNativeHandlers } from "@/lib/packs/function-handlers";

// Scenario execution proof: the registry functions behind the scenario
// widgets run on branch-shaped inputs end to end.

describe("scenario functions execute on branch shapes", () => {
  const changes = [{ objectId: "l1", data: { qty_on_hand: 100 } }];
  it("impact_sim previews staged branch changes", async () => {
    const sim = await executeFunctionSpec(
      EXTENDED_FUNCTION_SPECS.find((s) => s.key === "impact_sim")!,
      {
        lots: [{ id: "l1", key: "l1", data: { qty_on_hand: 10, reorder_point: 20, daily_demand: 5 } }],
        changes,
      },
      { nativeHandlers: allNativeHandlers },
    );
    expect(sim.ok).toBe(true);
    expect(sim.value).toMatchObject({ affected: 1 });
  });
  it("scenario_diff summarizes before/after like the board will show", async () => {
    const diff = await executeFunctionSpec(
      EXTENDED_FUNCTION_SPECS.find((s) => s.key === "scenario_diff")!,
      { before: { l1: { qty_on_hand: 10 } }, after: { l1: { qty_on_hand: 100 } } },
      { nativeHandlers: allNativeHandlers },
    );
    expect(diff.value).toEqual([{ field: "l1", before: { qty_on_hand: 10 }, after: { qty_on_hand: 100 } }]);
    expect(
      summarizeScenarioFlow(changes, { l1: { qty_on_hand: 10 } }, { l1: { qty_on_hand: 100 } }).diff,
    ).toEqual(diff.value);
  });
  it("both scenario functions are registered specs", () => {
    for (const key of ["impact_sim", "scenario_diff"] as const) {
      const spec = [...BUILTIN_FUNCTION_SPECS, ...EXTENDED_FUNCTION_SPECS].find((s) => s.key === key)!;
      expect(spec, key).toBeDefined();
    }
  });
});
