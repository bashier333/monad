import { NextResponse } from "next/server";
import { cancelRun, finalizeRun } from "@/lib/core/ingest/pipeline";
import { parseDecision } from "@/lib/core/imports/validate";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireWritable } from "@/lib/core/guards";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "upload:import");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const run = await db.importRun.findFirst({
    where: { id, organizationId: active.organization.id, status: "NEEDS_REVIEW" },
  });
  if (!run) return NextResponse.json({ error: "run is not awaiting review" }, { status: 409 });
  const blocked = await requireWritable(active.organization.id);
  if (blocked) return blocked;

  const requestId = req.headers.get("x-request-id") ?? "none";
  const body = (await req.json()) as { decision?: string };
  const decision = parseDecision(body.decision);
  if (!decision) {
    return NextResponse.json({ error: "decision must be merge, replace, or skip" }, { status: 400 });
  }
  if (decision === "skip") {
    await cancelRun(id, requestId, "skipped by user after duplicate/overlap review");
    return NextResponse.json({ ok: true, status: "CANCELLED" });
  }
  if (decision === "merge" || decision === "replace") {
    await finalizeRun(id, requestId, decision);
    return NextResponse.json({ ok: true, status: "COMPLETED" });
  }
  return NextResponse.json({ error: "decision must be merge, replace, or skip" }, { status: 400 });
}
