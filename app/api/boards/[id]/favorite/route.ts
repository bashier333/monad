import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireJson } from "@/lib/core/json-guard";
import { requireWritable } from "@/lib/core/guards";
import { toggleFavorite } from "@/lib/core/boards/store";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
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
  const body = (await req.json()) as { favorite?: unknown };
  if (typeof body.favorite !== "boolean") {
    return NextResponse.json({ error: "favorite boolean is required" }, { status: 400 });
  }
  const res = await toggleFavorite(active.organization.id, session.user.id, active.membership.role, id, body.favorite);
  if (!res.ok) {
    const status = res.error === "board not found" ? 404 : 403;
    return NextResponse.json({ error: res.error }, { status });
  }
  await logAccess(active.organization.id, session.user.id, "board:favorite", id);
  return NextResponse.json({ board: res.value });
}
