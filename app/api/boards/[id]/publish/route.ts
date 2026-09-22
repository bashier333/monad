import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireJson } from "@/lib/core/json-guard";
import { requireWritable } from "@/lib/core/guards";
import { publishBoard, revokeShareToken, rotateShareToken } from "@/lib/core/boards/store";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  const userId = session.user.id;
  try {
    requireCan(active.membership.role, "board:manage");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const guarded = requireJson(req);
  if (!guarded.ok) return guarded.response;
  const blocked = await requireWritable(active.organization.id);
  if (blocked) return blocked;
  const { id } = await ctx.params;
  const body = (await req.json()) as { status?: unknown; share?: unknown };
  if (body.share === "rotate") {
    const res = await rotateShareToken(active.organization.id, userId, active.membership.role, id);
    if (!res.ok) {
      const status = res.error === "board not found" ? 404 : res.error === "forbidden" ? 403 : 400;
      return NextResponse.json({ error: res.error }, { status });
    }
    await logAccess(active.organization.id, userId, "board:share", id);
    return NextResponse.json({ board: res.value });
  }
  if (body.share === "revoke") {
    const res = await revokeShareToken(active.organization.id, userId, active.membership.role, id);
    if (!res.ok) {
      const status = res.error === "board not found" ? 404 : 403;
      return NextResponse.json({ error: res.error }, { status });
    }
    await logAccess(active.organization.id, userId, "board:share-revoke", id);
    return NextResponse.json({ board: res.value });
  }
  if (body.status !== "draft" && body.status !== "published") {
    return NextResponse.json({ error: "status must be draft|published or share rotate|revoke" }, { status: 400 });
  }
  const res = await publishBoard(active.organization.id, userId, active.membership.role, id, body.status);
  if (!res.ok) {
    const status = res.error === "board not found" ? 404 : 403;
    return NextResponse.json({ error: res.error }, { status });
  }
  await logAccess(active.organization.id, userId, "board:publish", id);
  return NextResponse.json({ board: res.value });
}
