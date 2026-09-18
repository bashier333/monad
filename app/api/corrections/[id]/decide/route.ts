import { NextResponse } from "next/server";
import { bustAnswerCache } from "@/lib/answers/service";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAccess } from "@/lib/access";
import { notify } from "@/lib/notify";
import { getActiveOrg } from "@/lib/org";
import { requireCan } from "@/lib/roles";
import { requireWritable } from "@/lib/guards";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "correction:approve");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const correction = await db.correction.findFirst({
    where: { id, organizationId: active.organization.id },
  });
  if (!correction) return NextResponse.json({ error: "not found" }, { status: 404 });
  const blocked = await requireWritable(active.organization.id);
  if (blocked) return blocked;

  const body = (await req.json()) as { approve?: boolean; revert?: boolean };
  if (body.revert === true) {
    if (correction.status !== "applied") {
      return NextResponse.json({ error: "only applied corrections can be reverted" }, { status: 409 });
    }
    const reverted = await db.correction.update({
      where: { id },
      data: { status: "reverted", decidedById: session.user.id, decidedAt: new Date() },
    });
    await logAccess(active.organization.id, session.user.id, "correction:reverted", id);
    bustAnswerCache(active.organization.id);
    return NextResponse.json({ correction: reverted });
  }
  if (correction.status !== "open") {
    return NextResponse.json({ error: "correction is not open" }, { status: 409 });
  }
  const status = body.approve === false ? "rejected" : "applied";
  const updated = await db.correction.update({
    where: { id },
    data: { status, decidedById: session.user.id, decidedAt: new Date() },
  });
  await logAccess(active.organization.id, session.user.id, `correction:${status}`, id);
  bustAnswerCache(active.organization.id);
  if (updated.proposedById !== session.user.id) {
    await notify(active.organization.id, updated.proposedById, `correction:${status}`, `Your flag on ${updated.targetKey} was ${status}`, "/corrections");
  }
  return NextResponse.json({ correction: updated });
}
