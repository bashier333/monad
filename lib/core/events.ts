import { logger } from "@/lib/core/logger";

export const DOMAIN_EVENT_VERSION = 1;

export const EVENT_TYPES = [
  "import.completed",
  "import.needs_review",
  "answer.viewed",
  "correction.decided",
  "brief.generated",
  "billing.changed",
  "webhook.inbound",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export interface DomainEvent {
  id: string;
  type: EventType;
  version: number;
  orgId: string;
  pack: string;
  payload: Record<string, unknown>;
  at: string;
}

export interface EventIssue {
  field: string;
  message: string;
}

export function validateEvent(e: {
  type?: string;
  orgId?: string;
  pack?: string;
  payload?: unknown;
}): EventIssue[] {
  const issues: EventIssue[] = [];
  if (!e.type || !(EVENT_TYPES as readonly string[]).includes(e.type)) {
    issues.push({ field: "type", message: `type must be one of ${EVENT_TYPES.join(", ")}` });
  }
  if (!e.orgId) issues.push({ field: "orgId", message: "orgId is required" });
  if (e.pack !== undefined && typeof e.pack !== "string") {
    issues.push({ field: "pack", message: "pack must be a string" });
  }
  if (e.payload !== undefined && (typeof e.payload !== "object" || e.payload === null || Array.isArray(e.payload))) {
    issues.push({ field: "payload", message: "payload must be an object" });
  }
  return issues;
}

export async function signWebhook(secret: string, body: string, at: string): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${at}.${body}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const WEBHOOK_RETRIES = 3;

export function retryDelay(attempt: number): number {
  return Math.min(5000 * 2 ** attempt, 60_000);
}

export function shouldDeadLetter(attempts: number): boolean {
  return attempts >= WEBHOOK_RETRIES;
}

type PluginHook = (event: DomainEvent) => void | Promise<void>;

interface PluginRegistration {
  id: string;
  scopes: string[];
  hook: PluginHook;
}

const plugins = new Map<string, PluginRegistration>();

export function registerPlugin(reg: { id: string; scopes: string[]; hook: PluginHook }): void {
  if (!/^[a-z0-9-]+$/.test(reg.id)) throw new Error(`plugin id must be slug-case: ${reg.id}`);
  plugins.set(reg.id, { id: reg.id, scopes: reg.scopes, hook: reg.hook });
}

export function registeredPlugins(): string[] {
  return [...plugins.keys()];
}

export function clearPlugins(): void {
  plugins.clear();
}

export function pluginAllowed(reg: PluginRegistration, type: EventType): boolean {
  return reg.scopes.includes("*") || reg.scopes.includes(type);
}

export function runHookWithTimeout(
  reg: PluginRegistration,
  event: DomainEvent,
  timeoutMs = 2000,
): Promise<{ ok: boolean; error?: string }> {
  const scoped: DomainEvent = structuredClone(event);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, error: `plugin ${reg.id} timed out after ${timeoutMs}ms` }), timeoutMs);
    Promise.resolve()
      .then(() => reg.hook(scoped))
      .then(() => {
        clearTimeout(timer);
        resolve({ ok: true });
      })
      .catch((e: unknown) => {
        clearTimeout(timer);
        resolve({ ok: false, error: e instanceof Error ? e.message : String(e) });
      });
  });
}

export interface DeliverOpts {
  post?: (url: string, init: RequestInit) => Promise<{ ok: boolean; status: number }>;
  sleep?: (ms: number) => Promise<void>;
}

export async function deliverWebhook(
  endpoint: { url: string; secret: string },
  event: DomainEvent,
  opts: DeliverOpts = {},
): Promise<boolean> {
  const post = opts.post ?? ((u, init) => fetch(u, init).then((r) => ({ ok: r.ok, status: r.status })));
  const sleep = opts.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const body = JSON.stringify(event);
  const at = event.at;
  for (let attempt = 0; attempt <= WEBHOOK_RETRIES; attempt++) {
    try {
      const res = await post(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Decision-Signature": await signWebhook(endpoint.secret, body, at),
          "X-Decision-Event": event.id,
        },
        body,
      });
      if (res.ok) return true;
    } catch {
      // retry
    }
    if (attempt < WEBHOOK_RETRIES) await sleep(retryDelay(attempt));
  }
  return false;
}

export function makeEvent(type: EventType, orgId: string, pack: string, payload: Record<string, unknown>): DomainEvent {
  return { id: globalThis.crypto.randomUUID(), type, version: DOMAIN_EVENT_VERSION, orgId, pack, payload, at: new Date().toISOString() };
}

export interface EventSink {
  persist(event: DomainEvent): Promise<void>;
  markDead(eventId: string, attempts: number): Promise<void>;
  endpoints(orgId: string): Promise<Array<{ url: string; secret: string; events: string[] }>>;
}

export async function publishEvent(
  type: EventType,
  orgId: string,
  pack: string,
  payload: Record<string, unknown>,
  sink: EventSink,
): Promise<DomainEvent> {
  const event = makeEvent(type, orgId, pack, payload);
  await sink.persist(event);
  await fanOut(event, sink);
  return event;
}

export async function fanOut(event: DomainEvent, sink: EventSink, opts: DeliverOpts = {}): Promise<void> {
  for (const reg of plugins.values()) {
    if (!pluginAllowed(reg, event.type)) continue;
    const res = await runHookWithTimeout(reg, event);
    if (!res.ok) logger.warn("plugin hook failed", { plugin: reg.id, event: event.id, error: res.error });
  }
  const endpoints = await sink.endpoints(event.orgId);
  for (const ep of endpoints) {
    if (ep.events.length > 0 && !ep.events.includes(event.type)) continue;
    const delivered = await deliverWebhook(ep, event, opts);
    if (!delivered) {
      logger.warn("webhook dead-lettered", { event: event.id, url: ep.url });
      await sink.markDead(event.id, WEBHOOK_RETRIES);
    }
  }
}

export const EVENT_HOT_DAYS = 90;
