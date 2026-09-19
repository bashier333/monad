import { NextResponse } from "next/server";
import { resolveWeek } from "@/lib/core/answers/service";
import { v2Error, v2Data } from "@/lib/core/api-v2";
import { db } from "@/lib/core/db";

export async function GET(req: Request) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const url = new URL(req.url);
  let anchor: string | null = null;
  if (url.searchParams.get("week")) {
    try {
      anchor = resolveWeek(url.searchParams.get("week"));
    } catch {
      return v2Error(requestId, "invalid_period", "week must be YYYY-MM-DD", 400);
    }
  }

  const key = await authenticateKey(req, requestId, "read:imports");
  if ("response" in key) return key.response;

  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 200);
  const cursor = url.searchParams.get("cursor");
  const runs = await db.importRun.findMany({
    where: {
      organizationId: key.orgId,
      ...(anchor ? { dateMin: { gte: new Date(`${anchor}T00:00:00Z`) } } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { file: { select: { filename: true } } },
  });
  const nextCursor = runs.length > limit ? runs[runs.length - 1].id : null;
  const page = runs.slice(0, limit).map((r) => ({
    id: r.id,
    filename: r.file.filename,
    sourceType: r.sourceType,
    status: r.status,
    progress: r.progress,
    okRows: r.okRows,
    quarantinedRows: r.quarantinedRows,
    createdAt: r.createdAt.toISOString(),
  }));
  return v2Data(requestId, page, { cursor: nextCursor, total: page.length });
}

async function authenticateKey(
  req: Request,
  requestId: string,
  scope: "read:answers" | "read:imports" | "read:briefs",
): Promise<{ orgId: string } | { response: NextResponse }> {
  const { hashKey, hasScope, checkKeyRate } = await import("@/lib/core/apikeys");
  const raw = req.headers.get("x-api-key");
  if (!raw) {
    return { response: v2Error(requestId, "unauthorized", "X-API-Key header required", 401) };
  }
  const key = await db.apiKey.findUnique({ where: { keyHash: hashKey(raw) } });
  if (!key || key.revoked) {
    return { response: v2Error(requestId, "unauthorized", "invalid or revoked API key", 401) };
  }
  if (!hasScope({ scopes: (key.scopes as string[]) ?? [] }, scope)) {
    return { response: v2Error(requestId, "forbidden", `key lacks ${scope} scope`, 403) };
  }
  const rate = checkKeyRate(key.tier, key.id);
  if (!rate.ok) {
    return { response: v2Error(requestId, "rate_limited", "rate limited — slow down", 429) };
  }
  await db.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
  return { orgId: key.orgId };
}
