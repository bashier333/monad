import { describe, expect, it } from "vitest";
import {
  isExpired,
  isMuted,
  matchConditionRow,
  orderAutomations,
  retryDelayMs,
  shouldRetry,
  throttleAllows,
  validateAutomationSpec,
  type AutomationSpec,
} from "@/lib/core/automations/spec";
import { fireAutomation } from "@/lib/core/automations/runner";

// Automation runtime proof (H schedule/condition/manual + retries/mute/
// expiry/throttle/deps): spec validation, guards, ordering, dispatch with
// fallback. DB persistence (store.ts) follows the tested registry patterns.

const BASE = {
  key: "morning_brief",
  name: "Morning brief",
  maxRetries: 3,
  backoff: "exponential" as const,
  paused: false,
  dependsOn: [],
  enabled: true,
};

const SCHEDULE_SPEC = {
  ...BASE,
  trigger: { kind: "schedule", cron: "0 7 * * MON" },
  effects: [{ kind: "notify", message: "Brief ready" }],
} as unknown as AutomationSpec;

describe("validateAutomationSpec", () => {
  it("accepts schedule/condition/manual triggers", () => {
    expect(validateAutomationSpec(SCHEDULE_SPEC).ok).toBe(true);
    expect(
      validateAutomationSpec({
        ...BASE,
        trigger: { kind: "condition", field: "status", op: "eq", value: "delayed" },
        effects: [{ kind: "action", actionKey: "mfg_resolve_delay" }],
      }).ok,
    ).toBe(true);
    expect(
      validateAutomationSpec({ ...BASE, trigger: { kind: "manual" }, effects: [{ kind: "function", functionKey: "margin_rollup" }] }).ok,
    ).toBe(true);
  });
  it("rejects fallback-only, bad crons and targetless effects", () => {
    expect(
      validateAutomationSpec({ ...BASE, trigger: { kind: "manual" }, effects: [{ kind: "fallback", message: "x" }] }).ok,
    ).toBe(false);
    expect(
      validateAutomationSpec({ ...BASE, trigger: { kind: "schedule", cron: "daily" }, effects: SCHEDULE_SPEC.effects }).ok,
    ).toBe(false);
    expect(
      validateAutomationSpec({ ...BASE, trigger: { kind: "manual" }, effects: [{ kind: "action" }] }).ok,
    ).toBe(false);
    expect(validateAutomationSpec({ ...BASE, key: "Bad Key!" }).ok).toBe(false);
  });
});

describe("guards", () => {
  const now = Date.now();
  it("mute covers paused + mutedUntil; expiry is absolute", () => {
    expect(isMuted(SCHEDULE_SPEC, now)).toBe(false);
    expect(isMuted({ ...SCHEDULE_SPEC, paused: true }, now)).toBe(true);
    expect(isMuted({ ...SCHEDULE_SPEC, mutedUntilMs: now + 1000 }, now)).toBe(true);
    expect(isMuted({ ...SCHEDULE_SPEC, mutedUntilMs: now - 1000 }, now)).toBe(false);
    expect(isExpired(SCHEDULE_SPEC, now)).toBe(false);
    expect(isExpired({ ...SCHEDULE_SPEC, expiresAtMs: now - 1 }, now)).toBe(true);
  });
  it("throttle counts the trailing hour only", () => {
    expect(throttleAllows([now - 1000, now - 2000], now, 3)).toBe(true);
    expect(throttleAllows([now - 1000, now - 2000, now - 3000], now, 3)).toBe(false);
    expect(throttleAllows([now - 7200_000], now, 1)).toBe(true);
    expect(throttleAllows([], now)).toBe(true);
  });
  it("backoff schedules constant vs exponential with a cap", () => {
    expect(retryDelayMs(0, "constant")).toBe(30_000);
    expect(retryDelayMs(5, "constant")).toBe(30_000);
    expect(retryDelayMs(0, "exponential")).toBe(30_000);
    expect(retryDelayMs(1, "exponential")).toBe(60_000);
    expect(retryDelayMs(99, "exponential")).toBe(600_000);
    expect(shouldRetry(3, 3)).toBe(true);
    expect(shouldRetry(4, 3)).toBe(false);
  });
});

describe("orderAutomations", () => {
  const a: AutomationSpec = { ...SCHEDULE_SPEC, key: "a", dependsOn: ["b"] };
  const b: AutomationSpec = { ...SCHEDULE_SPEC, key: "b", dependsOn: [] };
  it("orders dependencies first, ignores unknown keys", () => {
    const c: AutomationSpec = { ...SCHEDULE_SPEC, key: "c", dependsOn: ["ghost"] };
    expect(orderAutomations([a, b, c]).map((s) => s.key).indexOf("b")).toBeLessThan(
      orderAutomations([a, b, c]).map((s) => s.key).indexOf("a"),
    );
  });
  it("cycles are a hard error naming the loop", () => {
    const x: AutomationSpec = { ...SCHEDULE_SPEC, key: "x", dependsOn: ["y"] };
    const y: AutomationSpec = { ...SCHEDULE_SPEC, key: "y", dependsOn: ["x"] };
    expect(() => orderAutomations([x, y])).toThrow(/cycle detected: x -> y -> x/);
  });
});

describe("matchConditionRow", () => {
  const row = { status: "delayed", miles: 240, note: "Shipper Delay" };
  it("evaluates all five operators honestly", () => {
    expect(matchConditionRow(row, { field: "status", op: "eq", value: "delayed" })).toBe(true);
    expect(matchConditionRow(row, { field: "status", op: "neq", value: "delayed" })).toBe(false);
    expect(matchConditionRow(row, { field: "note", op: "contains", value: "shipper" })).toBe(true);
    expect(matchConditionRow(row, { field: "miles", op: "gte", value: 200 })).toBe(true);
    expect(matchConditionRow(row, { field: "miles", op: "lte", value: 100 })).toBe(false);
    expect(matchConditionRow(row, { field: "nope", op: "eq", value: 1 })).toBe(false);
    expect(matchConditionRow(row, { field: "status", op: "teleport", value: 1 })).toBe(false);
  });
});

const RUNNERS = {
  runAction: async (actionKey: string) =>
    actionKey === "boom" ? { ok: false, error: "rejected" } : { ok: true },
  runFunction: async (key: string) =>
    key === "boom_fn" ? { ok: false, error: "math failed" } : { ok: true, value: 42 },
  notify: async () => {},
};

describe("fireAutomation dispatch", () => {
  it("runs primaries in order and reports ok", async () => {
    const spec: AutomationSpec = {
      ...SCHEDULE_SPEC,
      effects: [
        { kind: "function", functionKey: "margin_rollup" },
        { kind: "notify", message: "done", href: "/answers" },
      ],
    };
    const r = await fireAutomation(spec, { trigger: "schedule" }, RUNNERS);
    expect(r).toMatchObject({ automationKey: "morning_brief", trigger: "schedule", status: "ok" });
    expect(r.effects).toHaveLength(2);
    expect(r.effects[0]).toMatchObject({ kind: "function:margin_rollup", ok: true, value: 42 });
  });
  it("failed primaries trigger fallbacks; status degrades honestly", async () => {
    const spec: AutomationSpec = {
      ...SCHEDULE_SPEC,
      effects: [
        { kind: "action", actionKey: "boom" },
        { kind: "notify", message: "half" },
        { kind: "fallback", message: "primary failed, human needed" },
      ],
    };
    const r = await fireAutomation(spec, { trigger: "manual" }, RUNNERS);
    expect(r.status).toBe("partial");
    expect(r.effects.some((e) => e.kind === "fallback:notify" && e.ok)).toBe(true);
    const total: AutomationSpec = {
      ...SCHEDULE_SPEC,
      effects: [{ kind: "action", actionKey: "boom" }],
    };
    expect((await fireAutomation(total, { trigger: "manual" }, RUNNERS)).status).toBe("failed");
  });
  it("guards skip before any effect runs", async () => {
    let calls = 0;
    const counting = { ...RUNNERS, notify: async () => { calls++; } };
    const paused: AutomationSpec = { ...SCHEDULE_SPEC, paused: true };
    expect((await fireAutomation(paused, { trigger: "manual" }, counting)).status).toBe("skipped");
    const throttled: AutomationSpec = { ...SCHEDULE_SPEC, throttlePerHour: 1 };
    const now = Date.now();
    expect(
      (await fireAutomation(throttled, { trigger: "manual", nowMs: now, recentFiredAtMs: [now - 1000] }, counting)).status,
    ).toBe("skipped");
    expect(calls).toBe(0);
  });
  it("throwing runners are captured per effect, never escape", async () => {
    const spec: AutomationSpec = { ...SCHEDULE_SPEC, effects: [{ kind: "notify", message: "x" }] };
    const r = await fireAutomation(spec, { trigger: "manual" }, {
      ...RUNNERS,
      notify: async () => {
        throw new Error("pager down");
      },
    });
    expect(r.status).toBe("failed");
    expect(r.effects[0]!.error).toBe("pager down");
  });
});
