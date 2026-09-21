import { NextResponse } from "next/server";
import { checkRate } from "@/lib/core/ratelimit";
import { desktopRewrite, desktopBootstrapPath } from "@/lib/core/desktop";

const RULES: Array<{ prefix: string; limit: number; windowMs: number }> = [  { prefix: "/api/auth", limit: 30, windowMs: 60_000 },
  { prefix: "/api/uploads", limit: 20, windowMs: 60_000 },
  { prefix: "/api/answers", limit: 120, windowMs: 60_000 },
  { prefix: "/api/briefs/generate", limit: 10, windowMs: 60_000 },
  { prefix: "/api/rules/preview", limit: 30, windowMs: 60_000 },
  { prefix: "/api/hooks", limit: 60, windowMs: 60_000 },
  { prefix: "/api/search", limit: 60, windowMs: 60_000 },
  { prefix: "/s/", limit: 60, windowMs: 60_000 },
  { prefix: "/api/demo", limit: 10, windowMs: 60_000 },
  { prefix: "/api/download", limit: 10, windowMs: 60_000 },
  { prefix: "/api/updates", limit: 10, windowMs: 60_000 },
  { prefix: "/api/check", limit: 10, windowMs: 60_000 },
  { prefix: "/api/answers/export", limit: 30, windowMs: 60_000 },
];

export function clientIp(req: Request): string {
  const raw = req.headers.get("x-forwarded-for") ?? "";
  const chain = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (chain.length === 0) return "unknown";
  const ip = process.env.TRUSTED_PROXY ? chain[0] : chain[chain.length - 1];
  if (ip.includes(":")) {
    const parts = ip.split(":");
    if (parts.length > 4) return `${parts.slice(0, 4).join(":")}::/64`;
  }
  return ip;
}

const AUTHENTICATED_PATHS = [
  "/answers",
  "/briefs",
  "/corrections",
  "/upload",
  "/uploads",
  "/settings",
  "/admin",
  "/dashboard",
  "/imports",
  "/packs",
  "/activity",
  "/search",
  "/rules",
  "/pilots",
];

export function middleware(req: Request) {
  const url = new URL(req.url);
  if (process.env.MAINTENANCE === "true" && !url.pathname.startsWith("/api/health") && !url.pathname.startsWith("/status")) {
    return new NextResponse("Down for scheduled maintenance — back shortly. Status: /status.", {
      status: 503,
      headers: { "Retry-After": "1800", "Content-Type": "text/plain" },
    });
  }

  // Desktop (exe) mode: no sign-in stage. Any first full-page request without
  // a session cookie redirects through /api/desktop/bootstrap, which mints
  // the machine's owner session and sends the user back to their target.
  // Everything else (API calls, assets, the bootstrap route itself) passes.
  const bootstrap = desktopBootstrapPath(url.pathname, req.headers.get("accept") ?? "", req.headers.get("cookie") ?? "");
  if (bootstrap) {
    const dest = new URL(bootstrap.path, req.url);
    dest.searchParams.set("next", `${url.pathname}${url.search}`);
    return NextResponse.redirect(dest);
  }

  // Desktop (exe) mode hides the marketing site: those URLs render the
  // workspace home instead. Web deployments never set the flag.
  const rewrite = desktopRewrite(url.pathname);
  if (rewrite) {
    const dest = new URL(rewrite, req.url);
    dest.search = url.search;
    return NextResponse.rewrite(dest);
  }

  const res = NextResponse.next();
  res.headers.set("x-request-id", crypto.randomUUID());
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  if (AUTHENTICATED_PATHS.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))) {
    res.headers.set("Cache-Control", "no-store, must-revalidate");
  }

  const ip = clientIp(req);
  for (const r of RULES) {
    if (url.pathname.startsWith(r.prefix)) {
      const verdict = checkRate(`${r.prefix}:${ip}`, r.limit, r.windowMs);
      if (!verdict.ok) {
        console.warn(JSON.stringify({ ts: new Date().toISOString(), level: "warn", msg: "rate limited", prefix: r.prefix, ip }));
        return NextResponse.json({ error: "rate limited — slow down" }, {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(verdict.retryAfterMs / 1000)) },
        });
      }
    }
  }
  return res;
}
