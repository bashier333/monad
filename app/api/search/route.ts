import { NextResponse } from "next/server";
import { globalSearch, parseKind, validateQuery } from "@/lib/core/search";
import { auth } from "@/lib/core/auth";
import { getActiveOrg } from "@/lib/core/org";
import { logger } from "@/lib/core/logger";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const issues = validateQuery(q);
  if (issues.length > 0) return NextResponse.json({ error: issues[0].message }, { status: 400 });
  const kind = parseKind(url.searchParams.get("kind"));

  const t0 = Date.now();
  const hits = await globalSearch(active.organization.id, q, kind, null);
  const ms = Date.now() - t0;
  if (ms > 300) {
    logger.warn("search over latency budget", { q, ms, hits: hits.length });
  }
  return NextResponse.json({ hits, ms, kind });
}
