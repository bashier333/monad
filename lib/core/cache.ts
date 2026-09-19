interface Entry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, Entry>();
let hits = 0;
let misses = 0;
const hitsByPrefix = new Map<string, number>();
const missesByPrefix = new Map<string, number>();
const MAX_ENTRIES = 200;

function prefixOf(key: string): string {
  const parts = key.split(":");
  return parts.length > 2 ? `${parts[0]}:${parts[1]}` : (parts[0] ?? key);
}

export function cacheGet<T>(key: string, now = Date.now()): T | null {
  const e = store.get(key);
  if (!e || now >= e.expiresAt) {
    if (e) store.delete(key);
    misses++;
    missesByPrefix.set(prefixOf(key), (missesByPrefix.get(prefixOf(key)) ?? 0) + 1);
    return null;
  }
  hits++;
  hitsByPrefix.set(prefixOf(key), (hitsByPrefix.get(prefixOf(key)) ?? 0) + 1);
  return e.value as T;
}

export function cacheSet(key: string, value: unknown, ttlMs: number, now = Date.now()): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { value, expiresAt: now + ttlMs });
}

export function cacheBust(prefix: string): number {
  let n = 0;
  for (const k of [...store.keys()]) {
    if (k.startsWith(prefix)) {
      store.delete(k);
      n++;
    }
  }
  return n;
}

export function cacheStats(): {
  hits: number;
  misses: number;
  size: number;
  byPrefix: Record<string, { hits: number; misses: number }>;
} {
  const byPrefix: Record<string, { hits: number; misses: number }> = {};
  for (const [p, h] of hitsByPrefix) byPrefix[p] = { hits: h, misses: missesByPrefix.get(p) ?? 0 };
  for (const [p, m] of missesByPrefix) byPrefix[p] = byPrefix[p] ?? { hits: 0, misses: m };
  return { hits, misses, size: store.size, byPrefix };
}

export function clearCache(): void {
  store.clear();
  hits = 0;
  misses = 0;
  hitsByPrefix.clear();
  missesByPrefix.clear();
}

const inflight = new Map<string, Promise<unknown>>();

export async function singleflight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fn().finally(() => {
    if (inflight.get(key) === p) inflight.delete(key);
  });
  inflight.set(key, p);
  return p;
}
