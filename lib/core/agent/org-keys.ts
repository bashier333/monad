import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/core/db";
import { getEnv } from "@/lib/core/env";

// Bring-your-own AI provider keys. Server-only: this module reads the raw
// key material and must never be imported by client components.
// Storage: AES-256-GCM with a key derived from AUTH_SECRET. The database
// holds ciphertext plus a last-4 hint — never a usable secret. Rotating
// AUTH_SECRET invalidates stored keys (owners re-enter them in Settings).

export const ORG_KEY_PROVIDERS = ["nvidia", "anthropic", "openai"] as const;
export type OrgKeyProvider = (typeof ORG_KEY_PROVIDERS)[number];

export function isOrgKeyProvider(p: unknown): p is OrgKeyProvider {
  return typeof p === "string" && (ORG_KEY_PROVIDERS as readonly string[]).includes(p);
}

function boxKey(): Buffer {
  return createHash("sha256").update(`monad-provider-key:${getEnv().AUTH_SECRET}`).digest();
}

export function encryptProviderKey(raw: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", boxKey(), iv);
  const ct = Buffer.concat([cipher.update(raw, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${ct.toString("base64")}`;
}

export function decryptProviderKey(enc: string): string {
  const [ivB64, tagB64, ctB64] = enc.split(".");
  if (!ivB64 || !tagB64 || !ctB64) throw new Error("malformed provider key");
  const decipher = createDecipheriv("aes-256-gcm", boxKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}

export function keyHint(raw: string): string {
  const tail = raw.replace(/\s+/g, "").slice(-4);
  return tail ? `ends ${tail}` : "";
}

export async function saveOrgKey(organizationId: string, provider: OrgKeyProvider, rawKey: string): Promise<{ hint: string }> {
  const key = rawKey.trim();
  if (key.length < 8) throw new Error("key looks too short");
  const hint = keyHint(key);
  await db.providerKey.upsert({
    where: { organizationId_provider: { organizationId, provider } },
    create: { organizationId, provider, encKey: encryptProviderKey(key), keyHint: hint },
    update: { encKey: encryptProviderKey(key), keyHint: hint },
  });
  return { hint };
}

export async function orgKeyStatus(organizationId: string): Promise<Array<{ provider: string; hint: string; updatedAt: string }>> {
  const rows = await db.providerKey.findMany({
    where: { organizationId },
    select: { provider: true, keyHint: true, updatedAt: true },
  });
  return rows.map((r) => ({ provider: r.provider, hint: r.keyHint, updatedAt: r.updatedAt.toISOString() }));
}

export async function deleteOrgKey(organizationId: string, provider: OrgKeyProvider): Promise<void> {
  await db.providerKey.deleteMany({ where: { organizationId, provider } });
}

export async function resolveOrgKey(organizationId: string, provider: OrgKeyProvider): Promise<string | null> {
  const row = await db.providerKey.findUnique({
    where: { organizationId_provider: { organizationId, provider } },
    select: { encKey: true },
  });
  if (!row) return null;
  try {
    return decryptProviderKey(row.encKey);
  } catch {
    return null;
  }
}
