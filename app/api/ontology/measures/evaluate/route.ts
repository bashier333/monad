import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireJson } from "@/lib/core/json-guard";
import { evaluateFormula } from "@/lib/core/ontology/formulas";

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(userId);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  const guarded = requireJson(req);
  if (!guarded.ok) return guarded.response;
  const body = (await req.json()) as { formula?: string; context?: Record<string, unknown> };
  if (typeof body.formula !== "string" || body.formula.length === 0) {
    return NextResponse.json({ error: "formula is required" }, { status: 400 });
  }
  if (!body.context || typeof body.context !== "object") {
    return NextResponse.json({ error: "context object is required" }, { status: 400 });
  }
  try {
    const value = evaluateFormula(body.formula, body.context);
    await logAccess(active.organization.id, userId, "ontology:measure:evaluate", body.formula.slice(0, 120));
    return NextResponse.json({ value });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "evaluation failed" }, { status: 400 });
  }
}
