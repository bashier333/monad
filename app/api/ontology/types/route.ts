import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireJson } from "@/lib/core/json-guard";
import { requireWritable } from "@/lib/core/guards";
import { createType, listTypes } from "@/lib/core/ontology/registry";

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
  const types = await listTypes(ctx.active!.organization.id);
  return NextResponse.json({ types });
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
  const res = await createType(active.organization.id, userId, body);
  if (!res.ok) return NextResponse.json({ error: "invalid", problems: res.problems }, { status: 400 });
  await logAccess(active.organization.id, userId, "ontology:type:create", res.value.key);
  return NextResponse.json({ type: res.value }, { status: 201 });
}
