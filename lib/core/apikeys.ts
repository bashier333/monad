import { createHash, randomBytes } from "crypto";
import { checkRate } from "@/lib/core/ratelimit";

export const API_KEY_SCOPES = ["read:answers", "read:imports", "read:briefs"] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export const KEY_TIERS: Record<string, number> = {
  standard: 120,
  premium: 600,
};

export interface ApiKeyRecord {
  id: string;
  orgId: string;
  keyHash: string;
  prefix: string;
  scopes: string[];
  tier: string;
  revoked: boolean;
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateKey(): { key: string; hash: string; prefix: string } {
  const key = `dk_${randomBytes(24).toString("hex")}`;
  return { key, hash: hashKey(key), prefix: key.slice(0, 11) };
}

export function parseScopes(scopes: unknown): string[] {
  if (!Array.isArray(scopes)) return [];
  return scopes.filter((s): s is string => typeof s === "string" && (API_KEY_SCOPES as readonly string[]).includes(s));
}

export function hasScope(key: { scopes: string[] }, scope: ApiKeyScope): boolean {
  return key.scopes.includes(scope);
}

export function checkKeyRate(tier: string, keyId: string, now = Date.now()): { ok: boolean; retryAfterMs: number } {
  const limit = KEY_TIERS[tier] ?? KEY_TIERS.standard;
  return checkRate(`apikey:${keyId}`, limit, 60_000, now);
}

const idempotency = new Map<string, { at: number; response: unknown }>();
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000;

export function checkIdempotency(keyId: string, idemKey: string, now = Date.now()): { cached: boolean; response?: unknown } {
  if (!idemKey) return { cached: false };
  const k = `${keyId}:${idemKey}`;
  const hit = idempotency.get(k);
  if (hit && now - hit.at < IDEMPOTENCY_TTL) return { cached: true, response: hit.response };
  return { cached: false };
}

export function storeIdempotency(keyId: string, idemKey: string, response: unknown, now = Date.now()): void {
  if (!idemKey) return;
  for (const [k, v] of idempotency) {
    if (now - v.at >= IDEMPOTENCY_TTL) idempotency.delete(k);
  }
  idempotency.set(`${keyId}:${idemKey}`, { at: now, response });
}

export function clearIdempotency(): void {
  idempotency.clear();
}

export const API_VERSION = "2.0.0";
