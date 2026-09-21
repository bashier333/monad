import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireJson } from "@/lib/core/json-guard";
import { requireWritable } from "@/lib/core/guards";
import { checkOverlaps, readAsOf, recordFact } from "@/lib/core/ontology/facts";

async function context() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const active = await getActiveOrg(userId);
  if (!active) return { error: NextResponse.json({ error: "no organization" }, { status: 400 }) };
  return { userId, active };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const at = searchParams.get("at") ?? new Date().toISOString();
  const res = await readAsOf(ctx.active.organization.id, id, at);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 404 });
  return NextResponse.json({ objectId: id, at, state: res.value });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const { id } = await params;
  const body = (await req.json()) as {
    property?: string;
    value?: unknown;
    validFrom?: string;
    validTo?: string | null;
    reason?: string;
  };
  if (!body.property || !body.validFrom || body.value === undefined) {
    return NextResponse.json({ error: "property, value, and validFrom are required" }, { status: 400 });
  }
  const res = await recordFact(active.organization.id, id, {
    property: body.property,
    value: body.value,
    validFrom: body.validFrom,
    validTo: body.validTo ?? null,
    reason: body.reason,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  const overlaps = await checkOverlaps(active.organization.id, id);
  await logAccess(active.organization.id, userId, "ontology:fact:record", `${id}:${body.property}`);
  return NextResponse.json({ fact: res.value, overlaps }, { status: 201 });
}
