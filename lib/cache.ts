interface Entry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, Entry>();
let hits = 0;
let misses = 0;
const MAX_ENTRIES = 200;

export function cacheGet<T>(key: string, now = Date.now()): T | null {
  const e = store.get(key);
  if (!e || now >= e.expiresAt) {
    if (e) store.delete(key);
    misses++;
    return null;
  }
  hits++;
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

export function cacheStats(): { hits: number; misses: number; size: number } {
  return { hits, misses, size: store.size };
}

export function clearCache(): void {
  store.clear();
  hits = 0;
  misses = 0;
}
