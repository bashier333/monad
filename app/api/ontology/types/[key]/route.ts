import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireJson } from "@/lib/core/json-guard";
import { requireWritable } from "@/lib/core/guards";
import { deprecateType, listTypes, updateType } from "@/lib/core/ontology/registry";

async function context() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const active = await getActiveOrg(userId);
  if (!active) return { error: NextResponse.json({ error: "no organization" }, { status: 400 }) };
  return { userId, active };
}

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const { key } = await params;
  const types = await listTypes(ctx.active.organization.id);
  const found = types.find((t) => t.key === key);
  if (!found) return NextResponse.json({ error: "not found" }, { status: 404 });
  const versions = await db.ontoTypeVersion.findMany({
    where: { organizationId: ctx.active.organization.id, typeId: found.id },
    orderBy: { version: "desc" },
    take: 50,
  });
  return NextResponse.json({ type: found, versions });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ key: string }> }) {
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
  const { key } = await params;
  const body = (await req.json()) as unknown;
  const res = await updateType(active.organization.id, userId, key, body);
  if (!res.ok) return NextResponse.json({ error: "invalid", problems: res.problems }, { status: 400 });
  await logAccess(active.organization.id, userId, "ontology:type:update", key);
  return NextResponse.json({ version: res.value.version, diff: res.value.diff, plan: res.value.plan });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ key: string }> }) {
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
  const { key } = await params;
  const res = await deprecateType(active.organization.id, key);
  if (!res.ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  await logAccess(active.organization.id, userId, "ontology:type:deprecate", key);
  return NextResponse.json({ type: res.value });
}
