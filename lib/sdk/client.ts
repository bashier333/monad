// Decision Memory TS SDK (R-028) — minimal typed client for API v2.
// Zero dependencies; covers the shipped v2 surface. Python SDK lands with more endpoints.
export const SDK_VERSION = "2.0.0";
export interface SdkOptions {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof fetch;
}

export interface SdkEnvelope<T> {
  data: T;
  meta: { requestId: string; apiVersion: string; [k: string]: unknown };
}

export interface SdkAnswer {
  projects?: unknown[];
  lanes?: unknown[];
  totals: unknown;
  meta: unknown;
}

export interface SdkImportRun {
  id: string;
  filename: string;
  sourceType: string;
  status: string;
  progress: number;
  okRows: number;
  quarantinedRows: number;
  createdAt: string;
}

export class DecisionMemory {
  private baseUrl: string;
  private apiKey: string;
  private fetchImpl: typeof fetch;

  constructor(opts: SdkOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetch ?? fetch;
  }

  async getAnswer(params: { pack?: "freight" | "agency"; week?: string } = {}): Promise<SdkEnvelope<SdkAnswer>> {
    return this.get<SdkAnswer>("/api/v2/answers", params);
  }

  async getImports(params: { limit?: number; cursor?: string; week?: string } = {}): Promise<SdkEnvelope<SdkImportRun[]>> {
    return this.get<SdkImportRun[]>("/api/v2/imports", params);
  }

  private async get<T>(path: string, params: Record<string, string | number | undefined>): Promise<SdkEnvelope<T>> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    }
    const res = await this.fetchImpl(`${this.baseUrl}${path}${qs.size > 0 ? `?${qs}` : ""}`, {
      headers: { "X-API-Key": this.apiKey },
    });
    const body = (await res.json()) as SdkEnvelope<T> | { error: { code: string; message: string; requestId: string } };
    if ("error" in body) {
      throw new Error(`[${body.error.code}] ${body.error.message} (${body.error.requestId})`);
    }
    return body;
  }
}
