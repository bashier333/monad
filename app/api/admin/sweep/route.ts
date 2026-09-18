import { NextResponse } from "next/server";
import { sweepStaleRuns } from "@/lib/core/ingest/pipeline";
import { auth } from "@/lib/core/auth";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "billing:manage");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const reset = await sweepStaleRuns(req.headers.get("x-request-id") ?? "admin");
  return NextResponse.json({ reset });
}
