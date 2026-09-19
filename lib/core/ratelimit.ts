const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRate(
  key: string,
  limit: number,
  windowMs: number,
  now = typeof performance !== "undefined" ? performance.now() : Date.now(),
): { ok: boolean; retryAfterMs: number } {
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  if (b.count < limit) {
    b.count++;
    return { ok: true, retryAfterMs: 0 };
  }
  return { ok: false, retryAfterMs: Math.max(0, b.resetAt - now) };
}

export function clearRateBuckets(): void {
  buckets.clear();
}
