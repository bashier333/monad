import { describe, expect, it } from "vitest";
import { canAutoExecute } from "@/lib/core/ontology/actions";
import { drainIntents, enqueueIntent } from "@/lib/core/offline-queue";

// Action substrates proof: auto gate + offline queue (bulk/history/notify/
// webhook aspects ride on execute.ts, corrections-bulk, and webhooks.ts).

describe("canAutoExecute gate", () => {
  it("admits only approval-free enabled actions", () => {
    expect(canAutoExecute("none", true)).toBe(true);
    expect(canAutoExecute("single", true)).toBe(false);
    expect(canAutoExecute("quorum", true)).toBe(false);
    expect(canAutoExecute("none", false)).toBe(false);
  });
});

describe("offline intent queue", () => {
  it("enqueues FIFO and dedupes by idempotency key", () => {
    const a = { idempotencyKey: "k1", actionKey: "a", objectId: "o1" };
    const q1 = enqueueIntent([], a);
    expect(q1.deduped).toBe(false);
    expect(q1.queue).toHaveLength(1);
    expect(typeof q1.queue[0]!.queuedAt).toBe("string");
    const q2 = enqueueIntent(q1.queue, a);
    expect(q2.deduped).toBe(true);
    expect(q2.queue).toHaveLength(1);
    const q3 = enqueueIntent(q2.queue, { idempotencyKey: "k2", actionKey: "a", objectId: "o2" });
    expect(q3.queue.map((i) => i.idempotencyKey)).toEqual(["k1", "k2"]);
  });
  it("drains in order through the governed executor; failures stay queued", async () => {
    const seen: string[] = [];
    const { results, remaining } = await drainIntents(
      [
        { idempotencyKey: "k1", actionKey: "a", objectId: "o1", queuedAt: "t" },
        { idempotencyKey: "k2", actionKey: "a", objectId: "o2", queuedAt: "t" },
        { idempotencyKey: "k3", actionKey: "a", objectId: "o3", queuedAt: "t" },
      ],
      async (intent) => {
        seen.push(intent.idempotencyKey);
        if (intent.idempotencyKey === "k2") return { ok: false, error: "needs approval" };
        return { ok: true };
      },
    );
    expect(seen).toEqual(["k1", "k2", "k3"]);
    expect(results).toHaveLength(3);
    expect(remaining.map((r) => r.idempotencyKey)).toEqual(["k2"]);
  });
  it("executor throws are captured, never escape the drain", async () => {
    const { results, remaining } = await drainIntents(
      [{ idempotencyKey: "k9", actionKey: "a", objectId: "o", queuedAt: "t" }],
      async () => {
        throw new Error("offline db locked");
      },
    );
    expect(results[0]).toMatchObject({ key: "k9", ok: false });
    expect(remaining).toHaveLength(1);
  });
});
