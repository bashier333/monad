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
  const body = (await req.json().catch(() => ({}))) as { cancel?: boolean };
  if (body.cancel === true) {
    await db.orgDeletion.deleteMany({ where: { orgId: active.organization.id } });
    await logAccess(active.organization.id, session.user.id, "org:deletion-cancel", active.organization.id);
    return NextResponse.json({ ok: true, cancelled: true });
  }
  const purgeAt = new Date(Date.now() + 30 * 86_400_000);
  await db.orgDeletion.upsert({
    where: { orgId: active.organization.id },
    update: { purgeAt, requestedBy: session.user.id },
    create: { orgId: active.organization.id, requestedBy: session.user.id, purgeAt },
  });
  await logAccess(active.organization.id, session.user.id, "org:deletion-request", purgeAt.toISOString());
  return NextResponse.json({ ok: true, purgeAt: purgeAt.toISOString() });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  const pending = await db.orgDeletion.findUnique({ where: { orgId: active.organization.id } });
  return NextResponse.json({ pending });
}
