import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireJson } from "@/lib/core/json-guard";
import { requireWritable } from "@/lib/core/guards";
import { deleteBoard, getBoard, updateBoard } from "@/lib/core/boards/store";

async function context() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const active = await getActiveOrg(userId);
  if (!active) return { error: NextResponse.json({ error: "no organization" }, { status: 400 }) };
  return { userId, active };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const c = await context();
  if ("error" in c) return c.error;
  try {
    requireCan(c.active.membership.role, "board:view");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const board = await getBoard(c.active.organization.id, id);
  if (!board) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ board });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const c = await context();
  if ("error" in c) return c.error;
  const { userId, active } = c as Exclude<typeof c, { error: unknown }>;
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
  const body = (await req.json()) as unknown;
  const res = await updateBoard(active.organization.id, userId, active.membership.role, id, body);
  if (!res.ok) {
    const status = res.error === "board not found" ? 404 : res.error === "forbidden" ? 403 : 400;
    return NextResponse.json({ error: res.error ?? "invalid", problems: "problems" in res ? res.problems : [] }, { status });
  }
  await logAccess(active.organization.id, userId, "board:update", id);
  return NextResponse.json({ board: res.value });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const c = await context();
  if ("error" in c) return c.error;
  const { userId, active } = c as Exclude<typeof c, { error: unknown }>;
  try {
    requireCan(active.membership.role, "board:manage");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const blocked = await requireWritable(active.organization.id);
  if (blocked) return blocked;
  const { id } = await ctx.params;
  const res = await deleteBoard(active.organization.id, userId, active.membership.role, id);
  if (!res.ok) {
    const status = res.error === "board not found" ? 404 : 403;
    return NextResponse.json({ error: res.error }, { status });
  }
  await logAccess(active.organization.id, userId, "board:delete", id);
  return NextResponse.json({ deleted: id });
}
