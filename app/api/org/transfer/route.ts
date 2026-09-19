import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";
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
  const body = (await req.json()) as { userId?: string };
  if (!body.userId || body.userId === session.user.id) {
    return NextResponse.json({ error: "userId of another member required" }, { status: 400 });
  }
  const target = await db.membership.findFirst({
    where: { userId: body.userId, organizationId: active.organization.id },
  });
  if (!target) return NextResponse.json({ error: "not a member" }, { status: 404 });
  await db.$transaction([
    db.membership.update({ where: { id: target.id }, data: { role: "OWNER" } }),
    db.membership.update({ where: { id: active.membership.id }, data: { role: "DISPATCHER" } }),
  ]);
  await logAccess(active.organization.id, session.user.id, "org:transfer", body.userId);
  return NextResponse.json({ ok: true });
}
