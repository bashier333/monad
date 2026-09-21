import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireJson } from "@/lib/core/json-guard";
import { logger } from "@/lib/core/logger";
import { readCache, writeCache } from "@/lib/core/livedata/cache";
import { runCheck } from "@/lib/core/livedata/pipeline";

export async function POST(req: Request) {
  const guarded = requireJson(req);
  if (!guarded.ok) return guarded.response;
  const body = (await req.json()) as { company?: string };
  const company = typeof body.company === "string" ? body.company.trim().slice(0, 160) : "";
  if (company.length < 2) {
    return NextResponse.json({ error: "a company name of at least 2 characters is required" }, { status: 400 });
  }
  const session = await auth();
  const userId = session?.user?.id ?? "anonymous";
  let organizationId = "";
  if (session?.user?.id) {
    const active = await getActiveOrg(session.user.id);
    if (active) organizationId = active.organization.id;
  }
  const cached = readCache(company);
  if (cached) {
    return NextResponse.json({ ...cached, cached: true });
  }
  const requestId = crypto.randomUUID();
  logger.info("live check", { requestId, company, userId });
  const report = await runCheck(company);
  writeCache(company, report);
  if (organizationId) {
    await logAccess(organizationId, userId, "live:check", company.slice(0, 120));
  }
  return NextResponse.json({ ...report, cached: false });
}
