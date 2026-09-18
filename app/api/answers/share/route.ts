import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { resolveWeek } from "@/lib/core/answers/service";
import { cacheBust } from "@/lib/core/cache";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });

  const body = (await req.json()) as { week?: string };
  let anchor: string;
  try {
    anchor = resolveWeek(body.week ?? null);
  } catch {
    return NextResponse.json({ error: "invalid week parameter (use YYYY-MM-DD)" }, { status: 400 });
  }

  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + 30);
  const share = await db.answerShare.create({
    data: {
      organizationId: active.organization.id,
      weekStart: anchor,
      token: randomUUID(),
      expiresAt,
    },
  });
  const url = new URL(req.url);
  return NextResponse.json({ url: `${url.origin}/s/${share.token}`, expiresAt });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "billing:manage");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { token?: string };
  if (!body.token) return NextResponse.json({ error: "token required" }, { status: 400 });
  const share = await db.answerShare.findFirst({
    where: { token: body.token, organizationId: active.organization.id },
  });
  if (!share) return NextResponse.json({ error: "not found" }, { status: 404 });
  await db.answerShare.update({ where: { id: share.id }, data: { revoked: true } });
  cacheBust("share:");
  return NextResponse.json({ ok: true });
}
