import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json()) as { orgId?: string };
  if (!body.orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });
  const membership = await db.membership.findFirst({
    where: { userId: session.user.id, organizationId: body.orgId },
  });
  if (!membership) return NextResponse.json({ error: "not a member" }, { status: 403 });
  await logAccess(body.orgId, session.user.id, "org:switch", body.orgId);
  const res = NextResponse.json({ ok: true, orgId: body.orgId });
  res.cookies.set("activeOrgId", body.orgId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return res;
}
