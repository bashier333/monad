import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireJson } from "@/lib/core/json-guard";
import { requireWritable } from "@/lib/core/guards";
import { createLink, deleteLink } from "@/lib/core/ontology/registry";

async function context() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const active = await getActiveOrg(userId);
  if (!active) return { error: NextResponse.json({ error: "no organization" }, { status: 400 }) };
  return { userId, active };
}

export async function GET() {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const links = await db.ontoLink.findMany({
    where: { organizationId: ctx.active.organization.id },
    orderBy: { key: "asc" },
  });
  return NextResponse.json({ links });
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
  const body = (await req.json()) as unknown;
  const res = await createLink(active.organization.id, body);
  if (!res.ok) return NextResponse.json({ error: "invalid", problems: res.problems }, { status: 400 });
  await logAccess(active.organization.id, userId, "ontology:link:create", res.value.key);
  return NextResponse.json({ link: res.value }, { status: 201 });
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
  const key = searchParams.get("key") ?? "";
  const res = await deleteLink(active.organization.id, userId, key);
  if (!res.ok) {
    const missing = res.problems[0]?.message.includes("not found") ?? false;
    return NextResponse.json(
      { error: missing ? "not found" : "in use", problems: res.problems },
      { status: missing ? 404 : 409 },
    );
  }
  await logAccess(active.organization.id, userId, "ontology:link:delete", key);
  return NextResponse.json({ deleted: key });
}
