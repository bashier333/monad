import { describe, expect, it } from "vitest";
import { buildWebhookPayload, deliverWebhook, signWebhook, validateWebhookUrl } from "@/lib/core/ontology/webhooks";

describe("webhook signing and validation (MFG-0801)", () => {
  it("signs deterministically", () => {
    const a = signWebhook("secret", '{"a":1}');
    expect(a).toBe(signWebhook("secret", '{"a":1}'));
    expect(a).toHaveLength(64);
    expect(signWebhook("other", '{"a":1}')).not.toBe(a);
  });

  it("accepts http/https and rejects the rest", () => {
    expect(validateWebhookUrl("https://erp.example.com/hook").ok).toBe(true);
    expect(validateWebhookUrl("http://127.0.0.1:9/hook").ok).toBe(true);
    expect(validateWebhookUrl("ftp://x/y").ok).toBe(false);
    expect(validateWebhookUrl("not-a-url").ok).toBe(false);
    expect(validateWebhookUrl("").ok).toBe(false);
  });

  it("builds a stable pre-commit payload", () => {
    const p = buildWebhookPayload("org", "mfg_transfer_stock", "lot-1", "user-1", { qty: 10 });
    expect(p.event).toBe("action.pre_commit");
    expect(p.inputs).toEqual({ qty: 10 });
    expect(typeof p.at).toBe("string");
  });

  it("delivers through an injected fetch and signs the body", async () => {
    let seen: { url: string; headers: Record<string, string>; body: string } | null = null;
    const ok = await deliverWebhook(
      "https://erp.example.com/hook",
      "s3cret",
      buildWebhookPayload("org", "mfg_transfer_stock", "lot-1", "user-1", { qty: 10 }),
      async (url, init) => {
        seen = { url, headers: init.headers, body: init.body };
        return { status: 200 };
      }
    );
    expect(ok).toEqual({ ok: true, status: 200 });
    expect(seen!.headers["x-monad-event"]).toBe("action.pre_commit");
    expect(seen!.headers["x-monad-signature"]).toBe(signWebhook("s3cret", seen!.body));
  });

  it("blocks on non-2xx and on transport errors", async () => {
    const payload = buildWebhookPayload("org", "mfg_transfer_stock", "lot-1", "user-1", {});
    const bad = await deliverWebhook("https://erp.example.com/hook", "s", payload, async () => ({ status: 500 }));
    expect(bad.ok).toBe(false);
    const down = await deliverWebhook("https://erp.example.com/hook", "s", payload, async () => {
      throw new Error("connect refused");
    });
    expect(down.ok).toBe(false);
    if (!down.ok) expect(down.error).toContain("connect refused");
  });
});
