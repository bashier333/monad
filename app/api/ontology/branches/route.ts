import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireJson } from "@/lib/core/json-guard";
import { requireWritable } from "@/lib/core/guards";
import { createBranch } from "@/lib/core/ontology/branch-store";

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
  const full = ctx as Exclude<typeof ctx, { error: unknown }>;
  const branches = await db.ontoBranch.findMany({
    where: { organizationId: full.active.organization.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ branches });
}

export async function POST(req: Request) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const full = ctx as Exclude<typeof ctx, { error: unknown }>;
  try {
    requireCan(full.active.membership.role, "ontology:manage");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const guarded = requireJson(req);
  if (!guarded.ok) return guarded.response;
  const blocked = await requireWritable(full.active.organization.id);
  if (blocked) return blocked;
  const body = (await req.json()) as { name?: string; baseVersions?: Record<string, number> };
  if (!body.name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  const res = await createBranch(full.active.organization.id, full.userId, body.name, body.baseVersions ?? {});
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  await logAccess(full.active.organization.id, full.userId, "ontology:branch:create", body.name);
  return NextResponse.json({ branch: res.value }, { status: 201 });
}
