import { NextResponse } from "next/server";
import { bustAnswerCache } from "@/lib/answers/service";
import { validateRuleInput } from "@/lib/rules/validate";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAccess } from "@/lib/access";
import { getActiveOrg } from "@/lib/org";
import { requireCan } from "@/lib/roles";
import { requireWritable } from "@/lib/guards";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });

  const rules = await db.standingRule.findMany({
    where: { organizationId: active.organization.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ rules });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "rule:manage");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    costKind?: string;
    matchField?: string;
    matchValue?: string;
    toLoad?: string | null;
    reason?: string;
    sourceCorrectionId?: string;
  };
  const parsed = validateRuleInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { costKind, matchField, matchValue, toLoad, reason } = parsed.value;
  const blocked = await requireWritable(active.organization.id);
  if (blocked) return blocked;

  const rule = await db.standingRule.create({
    data: {
      organizationId: active.organization.id,
      kind: "reattribute",
      costKind,
      matchField,
      matchValue,
      toLoad,
      reason,
      authorId: session.user.id,
      sourceCorrectionId: typeof body.sourceCorrectionId === "string" ? body.sourceCorrectionId.slice(0, 64) : null,
    },
  });
  await logAccess(active.organization.id, session.user.id, "rule:create", rule.id);
  bustAnswerCache(active.organization.id);
  return NextResponse.json({ rule });
}
