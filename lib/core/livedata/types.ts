export type Severity = "info" | "warn" | "critical";

export interface LiveFlag {
  text: string;
  source: string;
  url?: string;
  severity: Severity;
  at?: string;
}

export interface SourceResult {
  source: string;
  ok: boolean;
  flags: LiveFlag[];
  error?: string;
  latencyMs: number;
  degraded?: boolean;
}

export type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

export interface ClientOpts {
  fetchImpl?: FetchImpl;
  timeoutMs?: number;
  retries?: number;
  token?: string;
}

export function degraded(source: string, error: string): SourceResult {
  return { source, ok: false, flags: [], error, latencyMs: 0, degraded: true };
}
