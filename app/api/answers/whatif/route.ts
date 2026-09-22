import { NextResponse } from "next/server";
import { getAgencyInputs, getAgencyCorrections, buildAgencyAnswer } from "@/lib/packs/agency/service";
import { getInputs, getActiveCorrections, buildAnswer } from "@/lib/packs/freight/service";
import { resolveWeek } from "@/lib/core/answers/service";
import { weekBounds } from "@/lib/core/dates";
import { auth } from "@/lib/core/auth";
import { getActiveOrg } from "@/lib/core/org";
import { logAccess } from "@/lib/core/access";
import { requireCan } from "@/lib/core/roles";
import { requireJson } from "@/lib/core/json-guard";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "upload:import");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const guardedJson1 = requireJson(req);
  if (!guardedJson1.ok) return guardedJson1.response;
  const body = (await req.json()) as { week?: string; pack?: string; group?: string; costDelta?: number };
  const pack = body.pack === "agency" ? "agency" : "freight";
  let anchor: string;
  try {
    anchor = resolveWeek(body.week ?? null);
  } catch {
    return NextResponse.json({ error: "invalid week parameter (use YYYY-MM-DD)" }, { status: 400 });
  }
  if (!body.group || !Number.isFinite(body.costDelta)) {
    return NextResponse.json({ error: "group + numeric costDelta required (e.g. {group: 'ACME', costDelta: -500})" }, { status: 400 });
  }

  const settings = (active.organization.settings ?? {}) as { agencyWeekStartsOn?: number };
  const weekStartsOn = pack === "agency" ? (settings.agencyWeekStartsOn ?? active.organization.weekStartsOn) : active.organization.weekStartsOn;
  const { start, end } = weekBounds(anchor, weekStartsOn);

  if (pack === "agency") {
    const [inputs, corrections] = await Promise.all([
      getAgencyInputs(active.organization.id),
      getAgencyCorrections(active.organization.id),
    ]);
    const base = buildAgencyAnswer(inputs, corrections, start, end);
  const target = base.projects.find((p) => p.project === body.group);
    if (!target) return NextResponse.json({ error: `no project named ${body.group} this week` }, { status: 404 });
  const newCost = Math.round((target.cost + body.costDelta!) * 100) / 100;
  const newMargin = Math.round((target.revenue - newCost) * 100) / 100;
  await logAccess(active.organization.id, session.user.id, "answers:whatif", body.group ?? "");
  return NextResponse.json({
    group: target.project,
      before: { cost: target.cost, margin: target.margin },
      after: { cost: newCost, margin: newMargin },
      delta: { cost: body.costDelta, margin: Math.round((newMargin - target.margin) * 100) / 100 },
      note: "sandbox only — nothing saved. Apply a correction to make it real.",
    });
  }

  const [inputs, corrections] = await Promise.all([
    getInputs(active.organization.id),
    getActiveCorrections(active.organization.id),
  ]);
  const base = buildAnswer(inputs, corrections, start, end);
  const target = base.lanes.find((l) => l.lane === body.group);
  if (!target) return NextResponse.json({ error: `no lane named ${body.group} this week` }, { status: 404 });
  const newCost = Math.round((target.cost + body.costDelta!) * 100) / 100;
  const newMargin = Math.round((target.revenue - newCost) * 100) / 100;
  await logAccess(active.organization.id, session.user.id, "answers:whatif", body.group ?? "");
  return NextResponse.json({
    group: target.lane,
    before: { cost: target.cost, margin: target.margin },
    after: { cost: newCost, margin: newMargin },
    delta: { cost: body.costDelta, margin: Math.round((newMargin - target.margin) * 100) / 100 },
    note: "sandbox only — nothing saved. Apply a correction to make it real.",
  });
}
