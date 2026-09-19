import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  const sessions = await db.session.findMany({
    where: { userId: session.user.id },
    select: { sessionToken: false, expires: true },
    orderBy: { expires: "desc" },
  });
  return NextResponse.json({ sessions: sessions.map((s) => ({ expires: s.expires })) });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  const result = await db.session.deleteMany({ where: { userId: session.user.id } });
  await logAccess(active.organization.id, session.user.id, "auth:logout-all", String(result.count));
  return NextResponse.json({ ok: true, revoked: result.count });
}
