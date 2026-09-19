import { NextResponse } from "next/server";

export function requireJson(req: Request): { ok: true } | { ok: false; response: NextResponse } {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().split(";")[0].trim().startsWith("application/json")) {
    return {
      ok: false,
      response: NextResponse.json({ error: "content-type must be application/json" }, { status: 415 }),
    };
  }
  return { ok: true };
}
