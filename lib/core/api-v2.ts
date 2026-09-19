import { NextResponse } from "next/server";
import { API_VERSION } from "@/lib/core/apikeys";

export const v2Headers = (requestId: string): Record<string, string> => ({
  "X-Request-Id": requestId,
  "X-API-Version": API_VERSION,
});

export function v2Error(requestId: string, code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ error: { code, message, requestId } }, { status, headers: v2Headers(requestId) });
}

export function v2Data<T>(requestId: string, data: T, meta: Record<string, unknown> = {}): NextResponse {
  return NextResponse.json(
    { data, meta: { requestId, apiVersion: API_VERSION, ...meta } },
    { headers: v2Headers(requestId) },
  );
}
