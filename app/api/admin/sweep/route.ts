import { NextResponse } from "next/server";
import { sweepStaleRuns } from "@/lib/ingest/pipeline";
import { auth } from "@/lib/auth";
import { getActiveOrg } from "@/lib/org";
import { requireCan } from "@/lib/roles";

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
