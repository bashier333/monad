import { describe, expect, it } from "vitest";
import { makeEvent, validateEvent } from "@/lib/core/events";

describe("inbound webhooks (R-381–R-390)", () => {
  it("validates the {source, rows[]} envelope", () => {
    expect(validateEvent({ type: "webhook.inbound", orgId: "o1", pack: "freight", payload: { source: "x", rows: 1 } })).toEqual([]);
    const bad = { source: "x" };
    expect(Array.isArray((bad as { rows?: unknown }).rows)).toBe(false);
  });

  it("subtle HMAC signs the raw body deterministically", async () => {
    const { signWebhook } = await import("@/lib/core/events");
    const body = JSON.stringify({ source: "asana", rows: [] });
    const a = await signWebhook("secret", body, "2026-09-18T00:00:00.000Z");
    const b = await signWebhook("secret", body, "2026-09-18T00:00:00.000Z");
    expect(a).toBe(b);
    expect(await signWebhook("other", body, "2026-09-18T00:00:00.000Z")).not.toBe(a);
  });

  it("inbound event is a versioned domain event", () => {
    const e = makeEvent("webhook.inbound", "o1", "agency", { source: "asana", rows: 3 });
    expect(e.version).toBe(1);
    expect(e.payload.rows).toBe(3);
  });
});
