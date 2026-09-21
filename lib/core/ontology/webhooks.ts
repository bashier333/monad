import { createHmac } from "node:crypto";
import { db } from "@/lib/core/db";
import { recordEvent } from "@/lib/core/ontology/facts";

// Outbound pre-commit webhooks: before an action writes back, the owning
// system (ERP, WMS, planner) gets a signed call and can veto by failing.
// Delivery failure blocks the write. Demo-grade transport note: any
// http/https URL is allowed, including localhost for local echo testing.
// Production hardening is an egress allowlist, not implemented here.
export const WEBHOOK_TIMEOUT_MS = 5000;
export const WEBHOOK_MAX_URL_LENGTH = 500;

export function signWebhook(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function validateWebhookUrl(url: string): { ok: true } | { ok: false; error: string } {
  if (!url || url.length > WEBHOOK_MAX_URL_LENGTH) return { ok: false, error: "url is required (max 500 chars)" };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: "url is not parseable" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "only http/https webhook URLs are allowed" };
  }
  return { ok: true };
}

export interface WebhookPayload {
  event: string;
  organizationId: string;
  actionKey: string;
  objectId: string;
  actorId: string;
  inputs: Record<string, unknown>;
  at: string;
}

export function buildWebhookPayload(
  organizationId: string,
  actionKey: string,
  objectId: string,
  actorId: string,
  inputs: Record<string, unknown>
): WebhookPayload {
  return {
    event: "action.pre_commit",
    organizationId,
    actionKey,
    objectId,
    actorId,
    inputs,
    at: new Date().toISOString(),
  };
}

export type FetchImpl = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{ status: number }>;

export async function deliverWebhook(
  url: string,
  secret: string,
  payload: WebhookPayload,
  fetchImpl: FetchImpl = fetch as unknown as FetchImpl,
  timeoutMs = WEBHOOK_TIMEOUT_MS
): Promise<{ ok: true; status: number } | { ok: false; error: string }> {
  const valid = validateWebhookUrl(url);
  if (!valid.ok) return valid;
  const body = JSON.stringify(payload);
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-monad-event": payload.event,
        "x-monad-signature": signWebhook(secret, body),
      },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status < 200 || res.status >= 300) return { ok: false, error: `webhook responded ${res.status}` };
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "webhook delivery failed" };
  }
}

export interface PreCommitResult {
  ok: boolean;
  skipped?: boolean;
  status?: number;
  error?: string;
}

// Loads the active webhook for this org+action (at most one) and delivers.
// No webhook configured means pass-through. Delivery outcome is audited and
// the row's last delivery status is updated.
export async function runPreCommitWebhooks(
  organizationId: string,
  actionKey: string,
  objectId: string,
  actorId: string,
  inputs: Record<string, unknown>,
  fetchImpl?: FetchImpl
): Promise<PreCommitResult> {
  const hook = await db.ontoWebhook.findUnique({
    where: { organizationId_actionKey: { organizationId, actionKey } },
  });
  if (!hook || !hook.active) return { ok: true, skipped: true };
  const payload = buildWebhookPayload(organizationId, actionKey, objectId, actorId, inputs);
  const delivered = await deliverWebhook(hook.url, hook.secret, payload, fetchImpl);
  await db.ontoWebhook.update({
    where: { id: hook.id },
    data: {
      lastStatus: delivered.ok ? delivered.status : -1,
      lastAt: new Date(),
    },
  });
  // after is a JSON *string* (not an object) on purpose: Postgres jsonb
  // re-sorts object keys on write, which would break hash verification for
  // freshly constructed objects. A scalar round-trips byte-identical.
  await recordEvent(organizationId, {
    kind: "action.webhook",
    objectId,
    actorId,
    after: JSON.stringify({ actionKey, ok: delivered.ok, status: delivered.ok ? delivered.status : null }),
  });
  if (!delivered.ok) return { ok: false, error: `pre-commit webhook blocked the write: ${delivered.error}` };
  return { ok: true, status: delivered.status };
}
