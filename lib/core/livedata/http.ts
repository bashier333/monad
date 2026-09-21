import type { FetchImpl } from "@/lib/core/livedata/types";

export interface HttpOpts {
  fetchImpl?: FetchImpl;
  timeoutMs?: number;
  headers?: Record<string, string>;
  retries?: number;
}

export type HttpOutcome =
  | { ok: true; status: number; json: unknown; latencyMs: number }
  | { ok: false; error: string; status?: number; latencyMs: number };

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJson(url: string, opts: HttpOpts = {}): Promise<HttpOutcome> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 8000;
  const retries = opts.retries ?? 2;
  let lastError = "unknown";
  let lastStatus: number | undefined;
  const t0 = Date.now();
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchImpl(url, {
        headers: { accept: "application/json", ...(opts.headers ?? {}) },
        signal: AbortSignal.timeout(timeoutMs),
      });
      lastStatus = res.status;
      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: `auth required (${res.status})`, status: res.status, latencyMs: Date.now() - t0 };
      }
      if (res.status === 404) {
        return { ok: false, error: "not found (404)", status: 404, latencyMs: Date.now() - t0 };
      }
      if (!res.ok) {
        lastError = `http ${res.status}`;
        if (RETRYABLE.has(res.status) && attempt < retries) {
          await sleep(400 * (attempt + 1));
          continue;
        }
        return { ok: false, error: lastError, status: res.status, latencyMs: Date.now() - t0 };
      }
      const json = (await res.json()) as unknown;
      return { ok: true, status: res.status, json, latencyMs: Date.now() - t0 };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "network error";
      if (attempt < retries) {
        await sleep(400 * (attempt + 1));
        continue;
      }
    }
  }
  return { ok: false, error: lastError, status: lastStatus, latencyMs: Date.now() - t0 };
}
