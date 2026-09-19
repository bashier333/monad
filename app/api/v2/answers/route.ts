import { NextResponse } from "next/server";
import { getWeeklyAnswer } from "@/lib/packs/freight/service";
import { getAgencyAnswer } from "@/lib/packs/agency/service";
import { resolveWeek } from "@/lib/core/answers/service";
import { packOrThrow } from "@/lib/core/packs";
import { v2Error, v2Data } from "@/lib/core/api-v2";

export async function GET(req: Request) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const url = new URL(req.url);
  const pack = url.searchParams.get("pack") ?? "freight";
  try {
    packOrThrow(pack);
  } catch {
    return v2Error(requestId, "unknown_pack", "pack must be freight|agency", 400);
  }
  let anchor: string;
  try {
    anchor = resolveWeek(url.searchParams.get("week"));
  } catch {
    return v2Error(requestId, "invalid_period", "week must be YYYY-MM-DD", 400);
  }

  const key = await authenticateKey(req, requestId, "read:answers");
  if ("response" in key) return key.response;

  const orgId = key.orgId;
  const settings = await getOrgSettings(orgId);
  if (pack === "agency") {
    const answer = await getAgencyAnswer(orgId, settings.agencyWeekStartsOn ?? settings.weekStartsOn, anchor);
    return v2Data(requestId, answer, { week: answer.meta.weekStart, pack });
  }
  const answer = await getWeeklyAnswer(orgId, settings.weekStartsOn, anchor);
  return v2Data(requestId, answer, { week: answer.meta.weekStart, pack });
}

async function getOrgSettings(orgId: string): Promise<{ weekStartsOn: number; agencyWeekStartsOn?: number }> {
  const { db } = await import("@/lib/core/db");
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { weekStartsOn: true, settings: true } });
  if (!org) throw new Error("org not found");
  const settings = (org.settings ?? {}) as { agencyWeekStartsOn?: number };
  return { weekStartsOn: org.weekStartsOn, agencyWeekStartsOn: settings.agencyWeekStartsOn };
}

async function authenticateKey(
  req: Request,
  requestId: string,
  scope: "read:answers" | "read:imports" | "read:briefs",
): Promise<{ orgId: string } | { response: NextResponse }> {
  const { db } = await import("@/lib/core/db");
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
