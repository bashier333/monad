import { describe, expect, it } from "vitest";
import {
  EVENT_TYPES,
  DOMAIN_EVENT_VERSION,
  makeEvent,
  registerPlugin,
  clearPlugins,
  registeredPlugins,
  runHookWithTimeout,
  pluginAllowed,
  shouldDeadLetter,
  retryDelay,
  signWebhook,
  validateEvent,
  deliverWebhook,
  fanOut,
  WEBHOOK_RETRIES,
  type DomainEvent,
  type EventSink,
} from "@/lib/core/events";

function event(over: Partial<DomainEvent> = {}): DomainEvent {
  return makeEvent("import.completed", "o1", "freight", { runId: "r1", okRows: 3, ...over.payload as object });
}

describe("event bus (R-001–R-003, R-011–R-013)", () => {
  it("validates events with versioned schema", () => {
    expect(validateEvent({ type: "import.completed", orgId: "o1", pack: "freight", payload: {} })).toEqual([]);
    expect(validateEvent({ type: "nope", orgId: "", payload: [] }).map((i) => i.field)).toEqual(["type", "orgId", "payload"]);
    expect(DOMAIN_EVENT_VERSION).toBe(1);
    expect(EVENT_TYPES.length).toBeGreaterThanOrEqual(5);
  });

  it("registers plugin hooks, checks scopes, sandboxed timeout", async () => {
    clearPlugins();
    registerPlugin({ id: "echo", scopes: ["*"], hook: (e) => void e });
    registerPlugin({ id: "scoped", scopes: ["answer.viewed"], hook: (e) => void e });
    expect(registeredPlugins().sort()).toEqual(["echo", "scoped"]);
    const e = event();
    expect(pluginAllowed({ id: "scoped", scopes: ["answer.viewed"], hook: () => {} }, "import.completed")).toBe(false);
    expect(pluginAllowed({ id: "echo", scopes: ["*"], hook: () => {} }, "import.completed")).toBe(true);

    const slow = registerPlugin({ id: "slow", scopes: ["*"], hook: () => new Promise((r) => setTimeout(r, 5000)) });
    void slow;
    const res = await runHookWithTimeout({ id: "slow", scopes: ["*"], hook: () => new Promise((r) => setTimeout(r, 5000)) }, e, 50);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/timed out/);

    const throwing = await runHookWithTimeout({ id: "boom", scopes: ["*"], hook: () => { throw new Error("x"); } }, e, 500);
    expect(throwing.ok).toBe(false);
    clearPlugins();
  });

  it("sandbox passes a payload copy, not the live event", async () => {
    let seen: DomainEvent | null = null;
    registerPlugin({
      id: "copycheck",
      scopes: ["*"],
      hook: (e) => {
        seen = e;
        e.payload.runId = "MUTATED";
      },
    });
    const e = event();
    await fanOut(e, memorySink());
    expect(seen!.payload.runId).toBe("MUTATED");
    expect(e.payload.runId).toBe("r1");
    clearPlugins();
  });

  it("webhook signature is deterministic; retry policy sane", async () => {
    expect(shouldDeadLetter(WEBHOOK_RETRIES)).toBe(true);
    expect(shouldDeadLetter(WEBHOOK_RETRIES - 1)).toBe(false);
    expect(retryDelay(0)).toBe(5000);
    expect(retryDelay(5)).toBe(60_000);
    const e = event();
    const secret = "s3cret";
    const body = JSON.stringify(e);
    expect(await signWebhook(secret, body, e.at)).toBe(await signWebhook(secret, body, e.at));
  });

  it("webhook delivery retries then dead-letters (fake sleep)", async () => {
    const e = event();
    let attempts = 0;
    const delivered = await deliverWebhook({ url: "http://flaky.test/hook", secret: "s" }, e, {
      post: async () => {
        attempts++;
        return { ok: attempts >= 3, status: attempts >= 3 ? 200 : 500 };
      },
      sleep: async () => {},
    });
    expect(delivered).toBe(true);
    expect(attempts).toBe(3);

    let alwaysFails = 0;
    const dead = await deliverWebhook({ url: "http://down.test/hook", secret: "s" }, e, {
      post: async () => {
        alwaysFails++;
        return { ok: false, status: 500 };
      },
      sleep: async () => {},
    });
    expect(dead).toBe(false);
    expect(alwaysFails).toBe(WEBHOOK_RETRIES + 1);
  });
});

function memorySink(failUrls: string[] = []): EventSink {
  const persisted: string[] = [];
  const dead: string[] = [];
  return {
    async persist(e) {
      persisted.push(e.id);
    },
    async markDead(id) {
      dead.push(id);
    },
    async endpoints() {
      return failUrls.map((url) => ({ url, secret: "s", events: [] }));
    },
  };
}

describe("event fan-out (R-001/R-002/R-007)", () => {
  it("fans out to plugins + dead-letters failing webhooks", async () => {
    clearPlugins();
    const calls: string[] = [];
    registerPlugin({ id: "counter", scopes: ["*"], hook: () => { calls.push("hook"); } });
    const persisted: string[] = [];
    const dead: string[] = [];
    const sink: EventSink = {
      async persist(e) {
        persisted.push(e.id);
      },
      async markDead(id) {
        dead.push(id);
      },
      async endpoints() {
        return [{ url: "http://down.test/hook", secret: "s", events: [] }];
      },
    };
    const e = event();
    await fanOut(e, sink, { post: async () => ({ ok: false, status: 500 }), sleep: async () => {} });
    expect(calls).toEqual(["hook"]);
    expect(dead).toEqual([e.id]);
    clearPlugins();
  });

  it("fan-out of 1k events through plugin hooks stays fast (R-007)", async () => {
    clearPlugins();
    let n = 0;
    registerPlugin({ id: "fast", scopes: ["*"], hook: () => { n++; } });
    const sink = memorySink();
    const t0 = Date.now();
    for (let i = 0; i < 1000; i++) {
      await fanOut(makeEvent("answer.viewed", "o1", "freight", { i }), sink);
    }
    expect(n).toBe(1000);
    expect(Date.now() - t0).toBeLessThan(2000);
    clearPlugins();
  });
});
