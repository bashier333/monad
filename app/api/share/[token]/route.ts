import { NextResponse } from "next/server";
import { getWeeklyAnswer } from "@/lib/answers/service";
import { cacheGet, cacheSet } from "@/lib/cache";
import { db } from "@/lib/db";

interface CachedShare {
  orgId: string;
  weekStart: string;
  orgName: string;
  weekStartsOn: number;
  expiresAtMs: number;
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const cacheKey = `share:${token}`;
  const now = Date.now();
  const cached = cacheGet<CachedShare>(cacheKey, now);

  let orgId: string;
  let weekStart: string;
  let orgName: string;
  let weekStartsOn: number;

  if (cached && cached.expiresAtMs > now) {
    ({ orgId, weekStart, orgName, weekStartsOn } = cached);
  } else {
    const share = await db.answerShare.findUnique({
      where: { token },
      include: { organization: true },
    });
    if (!share || share.revoked || share.expiresAt.getTime() <= now) {
      return NextResponse.json({ error: "link expired or invalid" }, { status: 404 });
    }
    orgId = share.organizationId;
    weekStart = share.weekStart;
    orgName = share.organization.name;
    weekStartsOn = share.organization.weekStartsOn;
    cacheSet(
      cacheKey,
      { orgId, weekStart, orgName, weekStartsOn, expiresAtMs: share.expiresAt.getTime() },
      60_000,
      now,
    );
  }

  const answer = await getWeeklyAnswer(orgId, weekStartsOn, weekStart);
  const { loads: _loads, ...rest } = answer;
  void _loads;
  return NextResponse.json({ orgName, ...rest });
}
