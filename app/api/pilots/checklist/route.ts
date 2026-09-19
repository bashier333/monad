import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });

  const checklist = await db.pilotChecklist.upsert({
    where: { organizationId: active.organization.id },
    update: {},
    create: { organizationId: active.organization.id },
  });

  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [answerViews, corrections, rules] = await Promise.all([
    db.meterEvent.count({ where: { organizationId: active.organization.id, kind: "answer_view", createdAt: { gte: weekAgo } } }),
    db.correction.count({ where: { organizationId: active.organization.id } }),
    db.standingRule.count({ where: { organizationId: active.organization.id, active: true } }),
  ]);

  return NextResponse.json({
    checklist,
    signals: {
      trailQueriesThisWeek: answerViews,
      correctionsTotal: corrections,
      activeRules: rules,
      pctBecomingRules: corrections === 0 ? null : Math.round((rules / corrections) * 10000) / 100,
    },
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });

  const body = (await req.json()) as { notes?: string; meetingUsed?: boolean };
  const data: { notes?: string; meetingConfirmedAt?: Date; meetingConfirmedBy?: string } = {};
  if (typeof body.notes === "string") data.notes = body.notes.slice(0, 5000);
  if (body.meetingUsed === true) {
    data.meetingConfirmedAt = new Date();
    data.meetingConfirmedBy = session.user.id;
  }
  const checklist = await db.pilotChecklist.upsert({
    where: { organizationId: active.organization.id },
    update: data,
    create: { organizationId: active.organization.id, ...data },
  });
  await logAccess(active.organization.id, session.user.id, "pilots:checklist", Object.keys(data).join(","), req.headers.get("x-request-id") ?? "none");
  return NextResponse.json({ checklist });
}
