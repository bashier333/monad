import { NextResponse } from "next/server";
import { getWeeklyAnswer } from "@/lib/packs/freight/service"; import { resolveWeek } from "@/lib/core/answers/service";
import { getAgencyAnswer } from "@/lib/packs/agency/service";
import { buildAgencyBrief } from "@/lib/packs/agency/brief/build";
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
import { recordEvent } from "@/lib/core/events-db";
import { fatigueGuard, learnedThresholdOverrides } from "@/lib/core/workflow";
import { appOrigin, escapeHtml } from "@/lib/core/security";

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
  const body = (await req.json().catch(() => ({}))) as { week?: string; pack?: string };
  let anchor: string;
  try {
    anchor = resolveWeek(body.week ?? null);
  } catch {
    return NextResponse.json({ error: "invalid week parameter" }, { status: 400 });
  }
  const pack = body.pack === "agency" ? "agency" : "freight";

  if (pack === "agency") {
    return generateAgencyBrief(req, active.organization.id, session.user.id, anchor, requestId, active.organization.weekStartsOn);
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
  const learned = learnedThresholdOverrides(
    (prev?.lanes ?? []).map((l) => ({ key: l.lane, margin: l.margin, marginPct: l.marginPct, cost: l.cost, costByKind: l.costByKind })),
  );
  const freightBrief = buildBrief(
    current,
    prev,
    openCorrections,
    settings.anomalyThresholdPts ?? DEFAULT_ANOMALY_PTS,
    newSince,
    {
      overrides: { ...learned, ...(settings.anomalyOverrides ?? {}) },
      suppressed: settings.anomalySuppressed,
      recentDecisions: decided.map((d) => ({ load: d.targetKey, field: d.field, status: d.status, reason: d.reason })),
    },
  );
  const { anomalies: freightAnomalies, digestNote: freightDigest } = fatigueGuard(freightBrief.anomalies);
  const content = {
    ...freightBrief,
    anomalies: freightAnomalies,
    paragraph: freightDigest ? `${freightBrief.paragraph} ${freightDigest}` : freightBrief.paragraph,
  };

  const brief = await db.brief.upsert({
    where: {
      organizationId_weekStart_pack: { organizationId: active.organization.id, weekStart: content.weekStart, pack: "freight" },
    },
    update: { content: content as unknown as object },
    create: {
      organizationId: active.organization.id,
      weekStart: content.weekStart,
      pack: "freight",
      content: content as unknown as object,
    },
  });

  const members = await db.membership.findMany({
    where: { organizationId: active.organization.id },
    include: { user: { select: { id: true, email: true, emailOptOut: true } } },
  });
  const origin = appOrigin(req.url);
  const emailedTo: string[] = [];
  for (const m of members) {
    if (!m.user.email || m.user.emailOptOut) continue;
    const unsub = unsubscribeUrl(origin, m.user.id);
    const html = `<p>${escapeHtml(content.paragraph)}</p><p><a href="${origin}/briefs/${content.weekStart}">Read the full brief</a></p><p><a href="${unsub}">Unsubscribe</a></p>`;
    const sent = await sendEmail(m.user.email, `Monday margin brief — week of ${content.weekStart}`, html, requestId, {
      "List-Unsubscribe": `<${unsub}>`,
    }, content.paragraph);
    if (sent) emailedTo.push(m.user.email);
  }
  await db.brief.update({ where: { id: brief.id }, data: { emailedTo } });
  await recordUsage(active.organization.id, "brief");
  await recordEvent("brief.generated", active.organization.id, "freight", { briefId: brief.id, week: content.weekStart });
  await logAccess(active.organization.id, session.user.id, "brief:generate", content.weekStart);
  logger.info("brief generated", { requestId, orgId: active.organization.id, week: content.weekStart, emailed: emailedTo.length });
  if (content.anomalies.length > 0 && settings.anomalyEmail === true) {
    const alertItems = content.anomalies.map((a) => `<li>${escapeHtml(a.lane)}: ${a.direction} ${Math.abs(a.swingPts)}pts (${a.causes.map((c) => escapeHtml(c)).join(", ")})</li>`).join("");
    const alertHtml = `<p>${content.anomalies.length} lanes moved more than expected:</p><ul>${alertItems}</ul><p><a href="${origin}/briefs/${content.weekStart}">Read the full brief</a></p>`;
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

async function generateAgencyBrief(
  req: Request,
  organizationId: string,
  userId: string,
  anchor: string,
  requestId: string,
  weekStartsOn: number,
) {
  const current = await getAgencyAnswer(organizationId, weekStartsOn, anchor);
  const prevAnchor = new Date(`${current.meta.weekStart}T00:00:00Z`);
  prevAnchor.setUTCDate(prevAnchor.getUTCDate() - 7);
  const prev = await getAgencyAnswer(organizationId, weekStartsOn, prevAnchor.toISOString().slice(0, 10));
  const openCorrections = await db.correction.count({ where: { organizationId, status: "open" } });
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { settings: true } });
  const settings = (org?.settings ?? {}) as {
    agencyAnomalyThresholdPts?: number;
    agencyAnomalyOverrides?: Record<string, number>;
    agencyAnomalySuppressed?: string[];
    agencyAnomalyEmail?: boolean;
    anomalyEmail?: boolean;
  };
  const newSince = await computeAgencyNewSince(organizationId, current.meta.weekStart, prev.meta.weekStart);
  const decided = await db.correction.findMany({
    where: {
      organizationId,
      status: { in: ["applied", "rejected"] },
      decidedAt: { gte: new Date(`${current.meta.weekStart}T00:00:00Z`) },
    },
    select: { targetKey: true, field: true, status: true, reason: true },
    take: 100,
  });
  const agencyLearned = learnedThresholdOverrides(
    (prev?.projects ?? []).map((p) => ({ key: p.project, margin: p.margin, marginPct: p.marginPct, cost: p.cost, costByKind: p.costByKind })),
  );
  const agencyBrief = buildAgencyBrief(
    current,
    prev,
    openCorrections,
    settings.agencyAnomalyThresholdPts ?? DEFAULT_ANOMALY_PTS,
    newSince,
    {
      overrides: { ...agencyLearned, ...(settings.agencyAnomalyOverrides ?? {}) },
      suppressed: settings.agencyAnomalySuppressed,
      recentDecisions: decided.map((d) => ({ load: d.targetKey, field: d.field, status: d.status, reason: d.reason })),
    },
  );
  const { anomalies: agencyAnomalies, digestNote: agencyDigest } = fatigueGuard(agencyBrief.anomalies);
  const content = {
    ...agencyBrief,
    anomalies: agencyAnomalies,
    paragraph: agencyDigest ? `${agencyBrief.paragraph} ${agencyDigest}` : agencyBrief.paragraph,
  };

  const brief = await db.brief.upsert({
    where: {
      organizationId_weekStart_pack: { organizationId, weekStart: content.weekStart, pack: "agency" },
    },
    update: { content: content as unknown as object },
    create: { organizationId, weekStart: content.weekStart, pack: "agency", content: content as unknown as object },
  });

  const members = await db.membership.findMany({
    where: { organizationId },
    include: { user: { select: { id: true, email: true, emailOptOut: true } } },
  });
  const origin = appOrigin(req.url);
  const emailedTo: string[] = [];
  for (const m of members) {
    if (!m.user.email || m.user.emailOptOut) continue;
    const unsub = unsubscribeUrl(origin, m.user.id);
    const html = `<p>${escapeHtml(content.paragraph)}</p><p><a href="${origin}/briefs/${content.weekStart}?pack=agency">Read the full brief</a></p><p><a href="${unsub}">Unsubscribe</a></p>`;
    const sent = await sendEmail(m.user.email, `Monday studio brief — week of ${content.weekStart}`, html, requestId, {
      "List-Unsubscribe": `<${unsub}>`,
    }, content.paragraph);
    if (sent) emailedTo.push(m.user.email);
  }
  await db.brief.update({ where: { id: brief.id }, data: { emailedTo } });
  await recordUsage(organizationId, "brief", 1, "agency");
  await recordEvent("brief.generated", organizationId, "agency", { briefId: brief.id, week: content.weekStart });
  await logAccess(organizationId, userId, "brief:generate", `agency:${content.weekStart}`);
  logger.info("agency brief generated", { requestId, orgId: organizationId, week: content.weekStart, emailed: emailedTo.length });
  if (content.anomalies.length > 0 && (settings.agencyAnomalyEmail ?? settings.anomalyEmail) === true) {
    const alertItems = content.anomalies.map((a) => `<li>${escapeHtml(a.lane)}: ${a.direction} ${Math.abs(a.swingPts)}pts (${a.causes.map((c) => escapeHtml(c)).join(", ")})</li>`).join("");
    const alertHtml = `<p>${content.anomalies.length} projects moved more than expected:</p><ul>${alertItems}</ul><p><a href="${origin}/briefs/${content.weekStart}?pack=agency">Read the full brief</a></p>`;
    for (const m of members) {
      if (!m.user.email || m.user.emailOptOut) continue;
      await sendEmail(m.user.email, `Studio alert — ${content.anomalies.length} projects moved`, alertHtml, requestId, {
        "List-Unsubscribe": `<${unsubscribeUrl(origin, m.user.id)}>`,
      });
    }
  }

  return NextResponse.json({ brief: { id: brief.id, weekStart: brief.weekStart, emailed: emailedTo.length }, content });
}

async function computeAgencyNewSince(
  organizationId: string,
  weekStart: string,
  prevWeekStart: string,
): Promise<{ projects: string[]; clients: string[]; team: string[] }> {
  const { getAliases } = await import("@/lib/core/answers/service");
  const { seedAgencyAliases } = await import("@/lib/packs/agency/places");
  const { normalizeProject, normalizeClient } = await import("@/lib/packs/agency/places");
  const staged = await db.stagedRecord.findMany({
    where: { organizationId, status: "ok", run: { status: "COMPLETED" } },
    select: { data: true },
    take: 200_000,
  });
  const aliases = await getAliases(organizationId, seedAgencyAliases());
  const cur = { projects: new Set<string>(), clients: new Set<string>(), team: new Set<string>() };
  const prv = { projects: new Set<string>(), clients: new Set<string>(), team: new Set<string>() };
  for (const s of staged) {
    const d = s.data as Record<string, string>;
    const day = d.date ? toISODate(d.date) : null;
    if (!day) continue;
    const bucket = day >= weekStart ? cur : day >= prevWeekStart ? prv : null;
    if (!bucket) continue;
    if (d.project) bucket.projects.add(normalizeProject(d.project, aliases));
    if (d.client) bucket.clients.add(normalizeClient(d.client, aliases));
    if (d.person) bucket.team.add(d.person.trim());
  }
  const diff = (a: Set<string>, b: Set<string>) => [...a].filter((x) => x && !b.has(x)).sort();
  return { projects: diff(cur.projects, prv.projects), clients: diff(cur.clients, prv.clients), team: diff(cur.team, prv.team) };
}

async function computeNewSince(organizationId: string, weekStart: string, prevWeekStart: string): Promise<NewSince> {
  const staged = await db.stagedRecord.findMany({
    where: { organizationId, status: "ok", run: { status: "COMPLETED", sourceType: { in: ["tms", "fuel", "broker", "manual"] } } },
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
