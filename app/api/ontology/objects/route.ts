import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireJson } from "@/lib/core/json-guard";
import { requireWritable } from "@/lib/core/guards";
import { createObject, listObjects, upsertObject } from "@/lib/core/ontology/objects";

async function context() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const active = await getActiveOrg(userId);
  if (!active) return { error: NextResponse.json({ error: "no organization" }, { status: 400 }) };
  return { userId, active };
}

export async function GET(req: Request) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const { searchParams } = new URL(req.url);
  const typeKey = searchParams.get("type") ?? "";
  if (!typeKey) return NextResponse.json({ error: "type is required" }, { status: 400 });
  const res = await listObjects(ctx.active.organization.id, typeKey, {
    cursor: searchParams.get("cursor") ?? undefined,
    take: Number(searchParams.get("take") ?? 50),
    query: searchParams.get("q") ?? undefined,
  });
  return NextResponse.json(res);
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
  const body = (await req.json()) as { type?: string; key?: string; data?: Record<string, unknown>; upsert?: boolean };
  if (!body.type || !body.key || typeof body.data !== "object") {
    return NextResponse.json({ error: "type, key, and data are required" }, { status: 400 });
  }
  const res = body.upsert
    ? await upsertObject(active.organization.id, body.type, { key: body.key, data: body.data })
    : await createObject(active.organization.id, body.type, { key: body.key, data: body.data });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  await logAccess(active.organization.id, userId, "ontology:object:write", `${body.type}:${body.key}`);
  return NextResponse.json({ object: res.value }, { status: 201 });
}
