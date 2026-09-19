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

  const items = await db.notification.findMany({
    where: { organizationId: active.organization.id, userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unread = items.filter((i) => !i.readAt).length;
  return NextResponse.json({ items, unread });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { id?: string; all?: boolean };
  if (body.all === true) {
    await db.notification.updateMany({
      where: { organizationId: active.organization.id, userId: session.user.id, readAt: null },
      data: { readAt: new Date() },
    });
    await logAccess(active.organization.id, session.user.id, "notifications:read-all", "", req.headers.get("x-request-id") ?? "none");
    return NextResponse.json({ ok: true });
  }
  if (!body.id) return NextResponse.json({ error: "id or all required" }, { status: 400 });
  await db.notification.updateMany({
    where: { id: body.id, organizationId: active.organization.id, userId: session.user.id },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
