import { NextResponse } from "next/server";
import { getWeeklyAnswer } from "@/lib/packs/freight/service"; import { resolveWeek } from "@/lib/core/answers/service";
import { buildBrief, DEFAULT_ANOMALY_PTS, type BriefContent, type NewSince } from "@/lib/packs/freight/brief/build";
import { sendEmail, unsubscribeUrl } from "@/lib/core/email";
import { toISODate } from "@/lib/packs/freight/margin/engine";
import { laneKey, seedAliases } from "@/lib/packs/freight/margin/places";
import { auth } from "@/lib/core/auth";
import { recordUsage } from "@/lib/core/billing";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";
import { logger } from "@/lib/core/logger";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireWritable } from "@/lib/core/guards";

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

  const requestId = req.headers.get("x-request-id") ?? "none";
  const blocked = await requireWritable(active.organization.id);
  if (blocked) return blocked;
  const body = (await req.json().catch(() => ({}))) as { week?: string };
  let anchor: string;
  try {
    anchor = resolveWeek(body.week ?? null);
  } catch {
    return NextResponse.json({ error: "invalid week parameter" }, { status: 400 });
  }

  const current = await getWeeklyAnswer(active.organization.id, active.organization.weekStartsOn, anchor);
  const prevAnchor = new Date(`${current.meta.weekStart}T00:00:00Z`);
  prevAnchor.setUTCDate(prevAnchor.getUTCDate() - 7);
  const prev = await getWeeklyAnswer(
    active.organization.id,
    active.organization.weekStartsOn,
    prevAnchor.toISOString().slice(0, 10),
  );
  const openCorrections = await db.correction.count({
    where: { organizationId: active.organization.id, status: "open" },
  });
  const settings = (active.organization.settings ?? {}) as {
    anomalyThresholdPts?: number;
    anomalyOverrides?: Record<string, number>;
    anomalySuppressed?: string[];
    anomalyEmail?: boolean;
  };
  const newSince = await computeNewSince(active.organization.id, current.meta.weekStart, prev.meta.weekStart);
  const decided = await db.correction.findMany({
    where: {
      organizationId: active.organization.id,
      status: { in: ["applied", "rejected"] },
      decidedAt: { gte: new Date(`${current.meta.weekStart}T00:00:00Z`) },
    },
    select: { targetKey: true, field: true, status: true, reason: true },
    take: 100,
  });
  const content = buildBrief(
    current,
    prev,
    openCorrections,
    settings.anomalyThresholdPts ?? DEFAULT_ANOMALY_PTS,
    newSince,
    {
      overrides: settings.anomalyOverrides,
      suppressed: settings.anomalySuppressed,
      recentDecisions: decided.map((d) => ({ load: d.targetKey, field: d.field, status: d.status, reason: d.reason })),
    },
  );

  const brief = await db.brief.upsert({
    where: {
      organizationId_weekStart: { organizationId: active.organization.id, weekStart: content.weekStart },
    },
    update: { content: content as unknown as object },
    create: {
      organizationId: active.organization.id,
      weekStart: content.weekStart,
      content: content as unknown as object,
    },
  });

  const members = await db.membership.findMany({
    where: { organizationId: active.organization.id },
    include: { user: { select: { id: true, email: true, emailOptOut: true } } },
  });
  const origin = new URL(req.url).origin;
  const emailedTo: string[] = [];
  for (const m of members) {
    if (!m.user.email || m.user.emailOptOut) continue;
    const unsub = unsubscribeUrl(origin, m.user.id);
    const html = `<p>${content.paragraph}</p><p><a href="${origin}/briefs/${content.weekStart}">Read the full brief</a></p><p><a href="${unsub}">Unsubscribe</a></p>`;
    const sent = await sendEmail(m.user.email, `Monday margin brief — week of ${content.weekStart}`, html, requestId, {
      "List-Unsubscribe": `<${unsub}>`,
    });
    if (sent) emailedTo.push(m.user.email);
  }
  await db.brief.update({ where: { id: brief.id }, data: { emailedTo } });
  await recordUsage(active.organization.id, "brief");
  await logAccess(active.organization.id, session.user.id, "brief:generate", content.weekStart);
  logger.info("brief generated", { requestId, orgId: active.organization.id, week: content.weekStart, emailed: emailedTo.length });
  if (content.anomalies.length > 0 && settings.anomalyEmail === true) {
    const alertHtml = `<p>${content.anomalies.length} lanes moved more than expected:</p><ul>${content.anomalies.map((a) => `<li>${a.lane}: ${a.direction} ${Math.abs(a.swingPts)}pts (${a.causes.join(", ")})</li>`).join("")}</ul><p><a href="${origin}/briefs/${content.weekStart}">Read the full brief</a></p>`;
    for (const m of members) {
      if (!m.user.email || m.user.emailOptOut) continue;
      await sendEmail(m.user.email, `Margin alert — ${content.anomalies.length} lanes moved`, alertHtml, requestId, {
        "List-Unsubscribe": `<${unsubscribeUrl(origin, m.user.id)}>`,
      });
    }
  }

  return NextResponse.json({ brief: { id: brief.id, weekStart: brief.weekStart, emailed: emailedTo.length }, content });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });

  const briefs = await db.brief.findMany({
    where: { organizationId: active.organization.id },
    orderBy: { weekStart: "desc" },
    take: 52,
    select: { id: true, weekStart: true, createdAt: true, feedback: true },
  });
  return NextResponse.json({ briefs });
}

export type { BriefContent };

async function computeNewSince(organizationId: string, weekStart: string, prevWeekStart: string): Promise<NewSince> {
  const staged = await db.stagedRecord.findMany({
    where: { organizationId, status: "ok", run: { status: "COMPLETED" } },
    select: { data: true },
    take: 200_000,
  });
  const aliasRows = await db.placeAlias.findMany({ where: { organizationId } });
  const aliases = seedAliases();
  for (const a of aliasRows) aliases.set(a.alias, a.canonical);
  const normPlace = (s: string) =>
    aliases.get(s.trim().toUpperCase().replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim()) ??
    s.trim().toUpperCase();

  const cur = { lanes: new Set<string>(), trucks: new Set<string>(), brokers: new Set<string>() };
  const prv = { lanes: new Set<string>(), trucks: new Set<string>(), brokers: new Set<string>() };
  for (const s of staged) {
    const d = s.data as Record<string, string>;
    const day = d.date ? toISODate(d.date) : null;
    if (!day) continue;
    const bucket = day >= weekStart ? cur : day >= prevWeekStart ? prv : null;
    if (!bucket) continue;
    if (d.origin && d.destination) bucket.lanes.add(laneKey(normPlace(d.origin), normPlace(d.destination)));
    if (d.truck) bucket.trucks.add(d.truck.trim());
    if (d.broker) bucket.brokers.add(d.broker.trim());
  }
  const diff = (a: Set<string>, b: Set<string>) => [...a].filter((x) => !b.has(x)).sort();
  return { lanes: diff(cur.lanes, prv.lanes), trucks: diff(cur.trucks, prv.trucks), brokers: diff(cur.brokers, prv.brokers) };
}
