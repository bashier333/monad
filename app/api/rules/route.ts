import { NextResponse } from "next/server";
import { bustAnswerCache } from "@/lib/core/answers/service";
import { validateRuleInput } from "@/lib/packs/freight/rules-validate";
import { validateAgencyRuleInput } from "@/lib/packs/agency/rules-validate";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireWritable } from "@/lib/core/guards";

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
    pack?: string;
  };
  const parsed =
    body.pack === "agency" ? validateAgencyRuleInput(body) : validateRuleInput(body);
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
