import { NextResponse } from "next/server";
import { buildAnswer, getInputs } from "@/lib/packs/freight/service"; import { resolveWeek } from "@/lib/core/answers/service";
import { expandRule, type RuleInput } from "@/lib/core/corrections/rules";
import { normalizePlace, laneKey } from "@/lib/packs/freight/margin/places";
import { FREIGHT_FIELD_KINDS } from "@/lib/packs/freight/margin/rules";
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
    requireCan(active.membership.role, "rule:manage");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const guardedJson1 = requireJson(req);
  if (!guardedJson1.ok) return guardedJson1.response;
  const body = (await req.json()) as { rule?: RuleInput; week?: string; pack?: string };
  if (!body.rule?.costKind || !body.rule?.matchField || !body.rule?.matchValue) {
    return NextResponse.json({ error: "rule with costKind, matchField, matchValue is required" }, { status: 400 });
  }
  let anchor: string;
  try {
    anchor = resolveWeek(body.week ?? null);
  } catch {
    return NextResponse.json({ error: "invalid week parameter" }, { status: 400 });
  }

  if (body.pack === "agency") {
    return previewAgency(active.organization.id, active.organization.weekStartsOn, anchor, body.rule);
  }

  const inputs = await getInputs(active.organization.id);
  const { weekBounds } = await import("@/lib/packs/freight/margin/engine");
  const { start, end } = weekBounds(anchor, active.organization.weekStartsOn);

  const matchable = inputs.loads.map((l) => ({
    loadKey: l.loadKey,
    driver: l.driver,
    origin: l.origin,
    destination: l.destination,
    broker: "",
    truck: l.truck,
    lane: laneKey(normalizePlace(l.origin, inputs.aliases), normalizePlace(l.destination, inputs.aliases)),
    date: l.date,
    revenue: l.revenue,
    miles: l.miles,
  }));
  const rule = normalizePreviewRule(body.rule);
  const corrections = expandRule({ id: "preview", ...rule }, matchable, FREIGHT_FIELD_KINDS);  const withRule = buildAnswer(inputs, corrections, start, end);
  const baseline = buildAnswer(inputs, [], start, end);

  const affectedLoads = [...new Set(corrections.map((c) => c.fromLoad))];
  const baseByLane = new Map(baseline.lanes.map((l) => [l.lane, l.margin]));
  const laneDeltas = withRule.lanes
    .map((l) => ({ lane: l.lane, delta: Math.round((l.margin - (baseByLane.get(l.lane) ?? l.margin)) * 100) / 100 }))
    .filter((d) => d.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const totalMoved = Math.round(laneDeltas.reduce((s, d) => s + Math.abs(d.delta), 0) * 100) / 100;
  const weeklyCost = withRule.totals.cost;
  const sample = withRule.adjustments.slice(0, 10).map((a) => a.description);
  await logAccess(active.organization.id, session.user.id, "rules:preview", anchor);

  return NextResponse.json({
    affectedLoads: affectedLoads.length,
    adjustments: withRule.adjustments.length,
    totalMoved,
    pctOfWeeklyCost: weeklyCost === 0 ? 0 : Math.round((totalMoved / weeklyCost) * 10000) / 100,
    laneDeltas: laneDeltas.slice(0, 10),
    sample,
    weekStart: start,
    weekEnd: end,
  });
}

function normalizePreviewRule(rule: RuleInput): RuleInput {
  const toLoad = rule.toLoad === "EXCLUDE" || rule.toLoad === "" ? null : rule.toLoad;
  return { ...rule, toLoad };
}

async function previewAgency(organizationId: string, weekStartsOn: number, anchor: string, rule: RuleInput) {  const { getAgencyInputs, buildAgencyAnswer } = await import("@/lib/packs/agency/service");
  const { AGENCY_FIELD_KINDS } = await import("@/lib/packs/agency/rules");
  const { weekBounds } = await import("@/lib/packs/agency/engine");
  const inputs = await getAgencyInputs(organizationId);
  const { start, end } = weekBounds(anchor, weekStartsOn);

  const matchable = inputs.records.map((r) => ({
    loadKey: r.recordKey,
    project: r.project,
    client: r.client,
    date: r.date,
    person: r.person,
    round: "",
    hours: r.hours,
    amount: "",
  }));
  const corrections = expandRule({ id: "preview", ...normalizePreviewRule(rule) }, matchable, AGENCY_FIELD_KINDS);
  const withRule = buildAgencyAnswer(inputs, corrections, start, end);
  const baseline = buildAgencyAnswer(inputs, [], start, end);

  const affectedLoads = [...new Set(corrections.map((c) => c.fromLoad))];
  const baseByProject = new Map(baseline.projects.map((p) => [p.project, p.margin]));
  const groupDeltas = withRule.projects
    .map((p) => ({ group: p.project, delta: Math.round((p.margin - (baseByProject.get(p.project) ?? p.margin)) * 100) / 100 }))
    .filter((d) => d.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const totalMoved = Math.round(groupDeltas.reduce((s, d) => s + Math.abs(d.delta), 0) * 100) / 100;
  const weeklyCost = withRule.totals.cost;
  const sample = withRule.adjustments.slice(0, 10).map((a) => a.description);

  return NextResponse.json({
    affectedLoads: affectedLoads.length,
    adjustments: withRule.adjustments.length,
    totalMoved,
    pctOfWeeklyCost: weeklyCost === 0 ? 0 : Math.round((totalMoved / weeklyCost) * 10000) / 100,
    groupDeltas: groupDeltas.slice(0, 10),
    sample,
    weekStart: start,
    weekEnd: end,
  });
}
