import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveOrg } from "@/lib/org";
import { requireCan } from "@/lib/roles";
import { requireWritable } from "@/lib/guards";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "correction:approve");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as { userId?: string };
  if (!body.userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
  const blocked = await requireWritable(active.organization.id);
  if (blocked) return blocked;

  const result = await db.correction.updateMany({
    where: { organizationId: active.organization.id, proposedById: body.userId, status: "applied" },
    data: { status: "reverted", decidedById: session.user.id, decidedAt: new Date() },
  });
  return NextResponse.json({ reverted: result.count });
}
