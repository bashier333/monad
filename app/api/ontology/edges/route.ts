import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireJson } from "@/lib/core/json-guard";
import { requireWritable } from "@/lib/core/guards";
import { createEdgeInstance, deleteEdgeInstance } from "@/lib/core/ontology/edges";

async function context() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const active = await getActiveOrg(userId);
  if (!active) return { error: NextResponse.json({ error: "no organization" }, { status: 400 }) };
  return { userId, active };
}

export async function POST(req: Request) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const { userId, active } = ctx as Exclude<typeof ctx, { error: unknown }>;
  try {
    requireCan(active.membership.role, "ontology:manage");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const guarded = requireJson(req);
  if (!guarded.ok) return guarded.response;
  const blocked = await requireWritable(active.organization.id);
  if (blocked) return blocked;
  const body = (await req.json()) as { fromId?: string; linkKey?: string; toId?: string };
  if (!body.fromId || !body.linkKey || !body.toId) {
    return NextResponse.json({ error: "fromId, linkKey, and toId are required" }, { status: 400 });
  }
  const res = await createEdgeInstance(active.organization.id, body.fromId, body.linkKey, body.toId);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  await logAccess(active.organization.id, userId, "ontology:edge:create", `${body.linkKey}`);
  return NextResponse.json({ edge: res.value }, { status: 201 });
}

export async function DELETE(req: Request) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const { userId, active } = ctx as Exclude<typeof ctx, { error: unknown }>;
  try {
    requireCan(active.membership.role, "ontology:manage");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const blocked = await requireWritable(active.organization.id);
  if (blocked) return blocked;
  const { searchParams } = new URL(req.url);
  const res = await deleteEdgeInstance(
    active.organization.id,
    searchParams.get("fromId") ?? "",
    searchParams.get("linkKey") ?? "",
    searchParams.get("toId") ?? ""
  );
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 404 });
  await logAccess(active.organization.id, userId, "ontology:edge:delete", searchParams.get("linkKey") ?? "");
  return NextResponse.json({ deleted: true });
}
