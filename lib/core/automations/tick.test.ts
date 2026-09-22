import { describe, expect, it } from "vitest";
import { runAutomationTick, type TickDeps } from "@/lib/core/automations/tick";
import type { AutomationSpec } from "@/lib/core/automations/spec";
import type { RunRecord } from "@/lib/core/automations/runner";

// Tick proof: schedule due/miss, condition match/miss, manual skip,
// dependency order, history recording — all through injected fakes.

function spec(partial: Partial<AutomationSpec> & { key: string }): AutomationSpec {
  return {
    name: partial.key,
    trigger: { kind: "manual" },
    effects: [{ kind: "notify", message: "hi" }],
    maxRetries: 3,
    backoff: "exponential",
    paused: false,
    dependsOn: [],
    enabled: true,
    ...partial,
  } as AutomationSpec;
}

function deps(partial: Partial<TickDeps> = {}): TickDeps & { runs: RunRecord[]; notified: string[] } {
  const runs: RunRecord[] = [];
  const notified: string[] = [];
  return {
    runs,
    notified,
    listSpecs: async () => [],
    getRows: async () => [],
    recentFiredAtMs: async () => [],
    runners: {
      runAction: async () => ({ ok: true }),
      runFunction: async () => ({ ok: true, value: 1 }),
      notify: async (m) => {
        notified.push(m);
      },
    },
    recordRun: async (r) => {
      runs.push(r);
    },
    ...partial,
  };
}

// Monday 2026-09-21 07:00 UTC fires "0 7 * * MON" and nothing else.
const MON_7AM = new Date("2026-09-21T07:00:00Z");
const TUE_7AM = new Date("2026-09-22T07:00:00Z");

describe("runAutomationTick", () => {
  it("fires due schedules, skips misses and manuals", async () => {
    const d = deps({
      listSpecs: async () => [
        spec({ key: "due", trigger: { kind: "schedule", cron: "0 7 * * MON" } }),
        spec({ key: "miss", trigger: { kind: "schedule", cron: "0 7 * * TUE" } }),
        spec({ key: "hands", trigger: { kind: "manual" } }),
        spec({ key: "off", trigger: { kind: "schedule", cron: "0 7 * * MON" }, enabled: false }),
      ],
    });
    const out = await runAutomationTick(MON_7AM, d);
    expect(out.map((r) => r.automationKey)).toEqual(["due"]);
    expect(out[0]).toMatchObject({ trigger: "schedule", status: "ok" });
    expect(d.runs).toHaveLength(1);
    expect(d.notified).toEqual(["hi"]);
    const tue = await runAutomationTick(TUE_7AM, deps({
      listSpecs: async () => [spec({ key: "miss", trigger: { kind: "schedule", cron: "0 7 * * TUE" } })],
    }));
    expect(tue.map((r) => r.automationKey)).toEqual(["miss"]);
  });
  it("condition triggers fire once with matched rows, skip on empty", async () => {
    const cond = spec({
      key: "watch",
      trigger: { kind: "condition", field: "status", op: "eq", value: "delayed" },
      effects: [{ kind: "function", functionKey: "margin_rollup" }],
    });
    const rows = [{ status: "delayed" }, { status: "planned" }];
    const hit = await runAutomationTick(MON_7AM, deps({ listSpecs: async () => [cond], getRows: async () => rows }));
    expect(hit).toHaveLength(1);
    expect(hit[0]!.status).toBe("ok");
    const miss = await runAutomationTick(MON_7AM, deps({ listSpecs: async () => [cond], getRows: async () => [{ status: "planned" }] }));
    expect(miss).toHaveLength(0);
  });
  it("orders by dependencies and records every run", async () => {
    const order: string[] = [];
    const d = deps({
      listSpecs: async () => [
        spec({ key: "second", trigger: { kind: "schedule", cron: "0 7 * * MON" }, dependsOn: ["first"] }),
        spec({ key: "first", trigger: { kind: "schedule", cron: "0 7 * * MON" } }),
      ],
      runners: {
        runAction: async () => ({ ok: true }),
        runFunction: async () => ({ ok: true }),
        notify: async (m) => {
          order.push(m);
        },
      },
    });
    const out = await runAutomationTick(MON_7AM, {
      ...d,
      listSpecs: async () => [
        { ...spec({ key: "second", trigger: { kind: "schedule", cron: "0 7 * * MON" }, dependsOn: ["first"] }), effects: [{ kind: "notify", message: "second" }] },
        { ...spec({ key: "first", trigger: { kind: "schedule", cron: "0 7 * * MON" } }), effects: [{ kind: "notify", message: "first" }] },
      ],
    });
    expect(out.map((r) => r.automationKey)).toEqual(["first", "second"]);
    expect(order).toEqual(["first", "second"]);
    expect(d.runs).toHaveLength(2);
  });
});
