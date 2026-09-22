export interface OfflineIntent {
  idempotencyKey: string;
  actionKey: string;
  objectId: string;
  inputs?: Record<string, unknown>;
  queuedAt: string;
}

// Exe offline intent queue (pure core; persistence lands with the exe
// SQLite work — the contract here is storage-agnostic by design).
// Offline executions enqueue instead of failing; on reconnect the queue
// drains FIFO through the normal governed execute path, so approvals,
// webhooks and audit apply identically. Idempotency keys dedupe: a retry
// never double-executes, online or offline.

export function enqueueIntent(
  queue: OfflineIntent[],
  intent: Omit<OfflineIntent, "queuedAt">,
): { queue: OfflineIntent[]; deduped: boolean } {
  if (queue.some((q) => q.idempotencyKey === intent.idempotencyKey)) {
    return { queue, deduped: true };
  }
  return {
    queue: [...queue, { ...intent, queuedAt: new Date().toISOString() }],
    deduped: false,
  };
}

export interface DrainResult {
  key: string;
  ok: boolean;
  error?: string;
}

export async function drainIntents(
  queue: OfflineIntent[],
  execute: (intent: OfflineIntent) => Promise<{ ok: boolean; error?: string }>,
): Promise<{ results: DrainResult[]; remaining: OfflineIntent[] }> {
  const results: DrainResult[] = [];
  const remaining: OfflineIntent[] = [];
  for (const intent of queue) {
    try {
      const r = await execute(intent);
      results.push({ key: intent.idempotencyKey, ok: r.ok, error: r.error });
      if (!r.ok) remaining.push(intent);
    } catch (e) {
      results.push({
        key: intent.idempotencyKey,
        ok: false,
        error: e instanceof Error ? e.message : "drain failed",
      });
      remaining.push(intent);
    }
  }
  return { results, remaining };
}
