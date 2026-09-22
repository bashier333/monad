import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireWritable } from "@/lib/core/guards";
import { requireJson } from "@/lib/core/json-guard";

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

  const guardedJson1 = requireJson(req);
  if (!guardedJson1.ok) return guardedJson1.response;
  const body = (await req.json()) as { userId?: string };
  if (!body.userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
  const blocked = await requireWritable(active.organization.id);
  if (blocked) return blocked;

  const targets = await db.correction.findMany({
    where: { organizationId: active.organization.id, proposedById: body.userId, status: "applied" },
    select: { id: true },
    take: 500,
  });
  const result = await db.correction.updateMany({
    where: { id: { in: targets.map((t) => t.id) } },
    data: { status: "reverted", decidedById: session.user.id, decidedAt: new Date() },
  });
  await logAccess(active.organization.id, session.user.id, "correction:bulk-revert", `${body.userId}:${result.count}`, req.headers.get("x-request-id") ?? "none");
  return NextResponse.json({ reverted: result.count });
}
