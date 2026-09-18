import { NextResponse } from "next/server";
import { buildAnswer, getInputs } from "@/lib/packs/freight/service"; import { resolveWeek } from "@/lib/core/answers/service";
import { expandRule, type RuleInput } from "@/lib/core/corrections/rules";
import { normalizePlace, laneKey } from "@/lib/packs/freight/margin/places";
import { FREIGHT_FIELD_KINDS } from "@/lib/packs/freight/margin/rules";
import { auth } from "@/lib/core/auth";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";

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

  const body = (await req.json()) as { rule?: RuleInput; week?: string };
  if (!body.rule?.costKind || !body.rule?.matchField || !body.rule?.matchValue) {
    return NextResponse.json({ error: "rule with costKind, matchField, matchValue is required" }, { status: 400 });
  }
  let anchor: string;
  try {
    anchor = resolveWeek(body.week ?? null);
  } catch {
    return NextResponse.json({ error: "invalid week parameter" }, { status: 400 });
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
  const corrections = expandRule({ id: "preview", ...body.rule }, matchable, FREIGHT_FIELD_KINDS);
  const withRule = buildAnswer(inputs, corrections, start, end);
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
