import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { resolveWeek } from "@/lib/core/answers/service";
import { cacheBust } from "@/lib/core/cache";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireJson } from "@/lib/core/json-guard";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });

  const guardedJson1 = requireJson(req);
  if (!guardedJson1.ok) return guardedJson1.response;
  const body = (await req.json()) as { week?: string; pack?: string };
  let anchor: string;
  try {
    anchor = resolveWeek(body.week ?? null);
  } catch {
    return NextResponse.json({ error: "invalid week parameter (use YYYY-MM-DD)" }, { status: 400 });
  }
  const pack = body.pack === "agency" ? "agency" : "freight";

  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + 30);
  const share = await db.answerShare.create({
    data: {
      organizationId: active.organization.id,
      weekStart: anchor,
      pack,
      token: randomBytes(16).toString("hex"),
      expiresAt,
    },
  });
  const url = new URL(req.url);
  await logAccess(active.organization.id, session.user.id, "share:create", share.id, req.headers.get("x-request-id") ?? "none");
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

  const guardedJson2 = requireJson(req);
  if (!guardedJson2.ok) return guardedJson2.response;
  const body = (await req.json().catch(() => ({}))) as { token?: string };
  if (!body.token) return NextResponse.json({ error: "token required" }, { status: 400 });
  const share = await db.answerShare.findFirst({
    where: { token: body.token, organizationId: active.organization.id },
  });
  if (!share) return NextResponse.json({ error: "not found" }, { status: 404 });
  await db.answerShare.update({ where: { id: share.id }, data: { revoked: true } });
  cacheBust("share:");
  await logAccess(active.organization.id, session.user.id, "share:revoke", share.id, req.headers.get("x-request-id") ?? "none");
  return NextResponse.json({ ok: true });
}
