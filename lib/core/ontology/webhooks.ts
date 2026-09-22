import { createHmac } from "node:crypto";
import { db } from "@/lib/core/db";
import { recordEvent } from "@/lib/core/ontology/facts";

// Outbound pre-commit webhooks: before an action writes back, the owning
// system (ERP, WMS, planner) gets a signed call and can veto by failing.
// Delivery failure blocks the write. Egress control: validateWebhookUrl is
// the syntax/protocol gate; checkEgressAllowed is the destination gate
// (allowlist + loopback policy), enforced on every delivery.
export const WEBHOOK_TIMEOUT_MS = 5000;
export const WEBHOOK_MAX_URL_LENGTH = 500;

export interface EgressPolicy {
  allowlist: string[];
  allowLoopback: boolean;
  strict: boolean;
}

// WEBHOOK_EGRESS_ALLOWLIST: comma-separated hosts ("erp.example.com,
// hooks.internal"). Exact match or subdomain suffix. Enforcement turns on
// when the allowlist is non-empty OR NODE_ENV=production (empty allowlist
// in production = deny-all with a clear error). Outside production with no
// allowlist, egress stays permissive for dev/test ergonomics.
// WEBHOOK_ALLOW_LOOPBACK=1 permits localhost/127/::1 explicitly (default on
// outside production, off inside).
export function egressPolicy(env: Record<string, string | undefined> = process.env): EgressPolicy {
  const allowlist = (env.WEBHOOK_EGRESS_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const production = env.NODE_ENV === "production";
  const loopbackDefault = production ? "0" : "1";
  return {
    allowlist,
    allowLoopback: (env.WEBHOOK_ALLOW_LOOPBACK ?? loopbackDefault) === "1",
    strict: production || allowlist.length > 0,
  };
}

function isLoopback(host: string): boolean {
  const h = host.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]" || h.endsWith(".localhost");
}

export function checkEgressAllowed(
  url: string,
  policy: EgressPolicy = egressPolicy(),
): { ok: true } | { ok: false; error: string } {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return { ok: false, error: "url is not parseable" };
  }
  if (isLoopback(host)) {
    return policy.allowLoopback
      ? { ok: true }
      : { ok: false, error: "loopback webhooks are disabled (set WEBHOOK_ALLOW_LOOPBACK=1 to permit)" };
  }
  if (!policy.strict) return { ok: true };
  const h = host.toLowerCase();
  const listed = policy.allowlist.some((a) => h === a || h.endsWith(`.${a}`));
  if (!listed) {
    return policy.allowlist.length === 0
      ? { ok: false, error: "egress allowlist is empty — set WEBHOOK_EGRESS_ALLOWLIST in production" }
      : { ok: false, error: `webhook host ${host} is not allowlisted` };
  }
  return { ok: true };
}

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
  timeoutMs = WEBHOOK_TIMEOUT_MS,
  egress: EgressPolicy = egressPolicy(),
): Promise<{ ok: true; status: number } | { ok: false; error: string }> {
  const valid = validateWebhookUrl(url);
  if (!valid.ok) return valid;
  const allowed = checkEgressAllowed(url, egress);
  if (!allowed.ok) return allowed;
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
