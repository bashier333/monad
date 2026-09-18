import { NextResponse } from "next/server";
import { checkRate } from "@/lib/core/ratelimit";

const RULES: Array<{ prefix: string; limit: number; windowMs: number }> = [
  { prefix: "/api/auth", limit: 30, windowMs: 60_000 },
  { prefix: "/api/uploads", limit: 20, windowMs: 60_000 },
  { prefix: "/api/answers", limit: 120, windowMs: 60_000 },
  { prefix: "/api/briefs/generate", limit: 10, windowMs: 60_000 },
  { prefix: "/api/rules/preview", limit: 30, windowMs: 60_000 },
];

export function middleware(req: Request) {
  const res = NextResponse.next();
  res.headers.set("x-request-id", crypto.randomUUID());

  const url = new URL(req.url);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  for (const r of RULES) {
    if (url.pathname.startsWith(r.prefix)) {
      const verdict = checkRate(`${r.prefix}:${ip}`, r.limit, r.windowMs);
      if (!verdict.ok) {
        return NextResponse.json({ error: "rate limited — slow down" }, {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(verdict.retryAfterMs / 1000)) },
        });
      }
    }
  }
  return res;
}
