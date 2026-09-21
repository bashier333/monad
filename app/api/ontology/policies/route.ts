import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireJson } from "@/lib/core/json-guard";
import { requireWritable } from "@/lib/core/guards";

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
  const full = ctx as Exclude<typeof ctx, { error: unknown }>;
  const { searchParams } = new URL(req.url);
  const typeKey = searchParams.get("type") ?? undefined;
  const policies = await db.ontoPolicy.findMany({
    where: { organizationId: full.active.organization.id, ...(typeKey ? { typeKey } : {}) },
    orderBy: { priority: "asc" },
  });
  return NextResponse.json({ policies });
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
  const body = (await req.json()) as {
    typeKey?: string;
    effect?: "allow" | "deny";
    field?: string;
    op?: "eq" | "neq" | "in" | "contains" | "startsWith";
    value?: unknown;
    priority?: number;
  };
  if (!body.typeKey || (body.effect !== "allow" && body.effect !== "deny")) {
    return NextResponse.json({ error: "typeKey and effect allow|deny are required" }, { status: 400 });
  }
  const created = await db.ontoPolicy.create({
    data: {
      organizationId: full.active.organization.id,
      typeKey: body.typeKey,
      effect: body.effect,
      field: body.field ?? "",
      op: body.op ?? "eq",
      value: (body.value ?? null) as never,
      priority: body.priority ?? 100,
    },
  });
  await logAccess(full.active.organization.id, full.userId, "ontology:policy:create", body.typeKey);
  return NextResponse.json({ policy: created }, { status: 201 });
}
