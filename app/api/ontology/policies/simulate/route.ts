import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { logAccess } from "@/lib/core/access";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";
import { requireJson } from "@/lib/core/json-guard";
import { evaluatePolicies } from "@/lib/core/ontology/policies";

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(userId);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  const guarded = requireJson(req);
  if (!guarded.ok) return guarded.response;
  const body = (await req.json()) as { typeKey?: string; row?: Record<string, unknown> };
  if (!body.typeKey || !body.row || typeof body.row !== "object") {
    return NextResponse.json({ error: "typeKey and row are required" }, { status: 400 });
  }
  const policies = await db.ontoPolicy.findMany({
    where: { organizationId: active.organization.id, typeKey: body.typeKey, active: true },
    orderBy: { priority: "asc" },
  });
  const allowed = evaluatePolicies(
    policies.map((p) => ({ effect: p.effect as "allow" | "deny", field: p.field, op: p.op as never, value: p.value, priority: p.priority })),
    body.row
  );
  await logAccess(active.organization.id, userId, "ontology:policy:simulate", body.typeKey);
  return NextResponse.json({ allowed });
}
