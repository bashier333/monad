import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { recordUsage } from "@/lib/core/billing";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { appOrigin, hashEmail, parseInviteRole, validateInviteEmail } from "@/lib/core/security";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });

  const members = await db.membership.findMany({
    where: { organizationId: active.organization.id },
    include: { user: { select: { email: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({
    members: members.map((m) => ({ email: m.user.email, name: m.user.name, role: m.role })),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "org:invite");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as { email?: string; role?: "DISPATCHER" | "VIEWER" };
  const parsed = validateInviteEmail(body.email);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const email = parsed.email;
  const role = parseInviteRole(body.role);

  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });
  await db.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: active.organization.id } },
    update: { role },
    create: { userId: user.id, organizationId: active.organization.id, role },
  });
  await recordUsage(active.organization.id, "seat");
  await logAccess(active.organization.id, session.user.id, "org:invite", hashEmail(email));

  const origin = appOrigin(req.url);
  return NextResponse.json({
    ok: true,
    magicLink: `${origin}/api/auth/signin?callbackUrl=${encodeURIComponent("/answers")}`,
    note: "Email delivery pending Resend key — send this link manually for now.",
  });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "org:invite");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
  if (email === session.user.email) {
    return NextResponse.json({ error: "cannot remove yourself" }, { status: 400 });
  }
  const user = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (user) {
    await db.membership.deleteMany({
      where: { userId: user.id, organizationId: active.organization.id },
    });
    await logAccess(active.organization.id, session.user.id, "org:revoke", hashEmail(email));
  }
  return NextResponse.json({ ok: true });
}
