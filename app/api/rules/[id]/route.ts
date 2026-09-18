import { NextResponse } from "next/server";
import { bustAnswerCache } from "@/lib/core/answers/service";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireWritable } from "@/lib/core/guards";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "rule:manage");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rule = await db.standingRule.findFirst({
    where: { id, organizationId: active.organization.id },
  });
  if (!rule) return NextResponse.json({ error: "not found" }, { status: 404 });
  const blocked = await requireWritable(active.organization.id);
  if (blocked) return blocked;

  const body = (await req.json()) as { active?: boolean };
  const updated = await db.standingRule.update({
    where: { id },
    data: { active: body.active !== false },
  });
  await logAccess(active.organization.id, session.user.id, `rule:${updated.active ? "enable" : "disable"}`, id);
  bustAnswerCache(active.organization.id);
  return NextResponse.json({ rule: updated });
}
