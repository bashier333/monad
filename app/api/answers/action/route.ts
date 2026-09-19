import { NextResponse } from "next/server";
import { describeAction, parseAction, validateActionParams } from "@/lib/core/answers/actions";
import { resolveWeek } from "@/lib/core/answers/service";
import { cacheBust } from "@/lib/core/cache";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { packEnabled } from "@/lib/core/packs";
import { getWeeklyAnswer } from "@/lib/packs/freight/service";
import { getAgencyAnswer } from "@/lib/packs/agency/service";
import { validateAlertRule } from "@/lib/core/workflow";

const NUM_RE = /\$?(\d[\d,]*(?:\.\d+)?)/;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });

  const body = (await req.json()) as { query?: string; week?: string; pack?: string; confirm?: boolean };
  const pack = body.pack === "agency" ? "agency" : "freight";
  const action = body.query ? parseAction(body.query, pack) : null;
  if (!action) {
    return NextResponse.json({ error: "not an action — try 'flag all detention over $50' or 'export this view'" }, { status: 400 });
  }
  const paramError = validateActionParams(action);
  if (paramError) {
    return NextResponse.json({ error: paramError }, { status: 400 });
  }

  let anchor: string;
  try {
    anchor = resolveWeek(body.week ?? null);
  } catch {
    return NextResponse.json({ error: "invalid week parameter (use YYYY-MM-DD)" }, { status: 400 });
  }

  if (!body.confirm) {
    await logAccess(active.organization.id, session.user.id, "action:preview", action.action);
    return NextResponse.json({ needsConfirm: true, action: action.action, preview: describeAction(action) });
  }

  const result = await executeAction(active.organization.id, session.user.id, action.action, anchor, pack, action.params);
  await logAccess(active.organization.id, session.user.id, "action:run", JSON.stringify({ action: action.action, ...result.summary }).slice(0, 200));
  return NextResponse.json({ ok: true, action: action.action, ...result });
}

type ActionParams = NonNullable<ReturnType<typeof parseAction>>["params"];

async function executeAction(
  orgId: string,
  userId: string,
  action: string,
  anchor: string,
  pack: string,
  params: ActionParams,
): Promise<{ summary: Record<string, unknown>; [k: string]: unknown }> {
  if (action === "flag") {
    const threshold = params.threshold ?? 0;
    const field = params.field ?? "labor";
    const freightKinds = new Set(["detention", "fee", "fuel"]);
    const staged = await db.stagedRecord.findMany({
      where: { organizationId: orgId, status: "ok", run: { status: "COMPLETED" } },
      include: { run: { select: { sourceType: true } } },
      take: 50_000,
    });
    const targets: Array<{ targetKey: string; field: string; oldValue: string }> = [];
    for (const s of staged) {
      const d = s.data as Record<string, string>;
      const isAgency = !freightKinds.has(s.run.sourceType);
      const kind = isAgency ? "labor" : s.run.sourceType === "fuel" ? "fuel" : s.run.sourceType === "broker" ? "fee" : "detention";
      if (kind !== field && !(field === "labor" && isAgency)) continue;
      const candidates: Array<{ key: string; value: string }> = isAgency
        ? [{ key: d.recordKey ?? "", value: d.hours ?? "" }]
        : kind === "detention"
          ? [{ key: d.loadId ?? "", value: d.detention ?? "" }]
          : kind === "fee"
            ? [{ key: d.loadId ?? "", value: d.fee ?? "" }]
            : [{ key: d.loadId ?? "", value: d.amount ?? "" }];
      for (const c of candidates) {
        if (!c.key || !c.value) continue;
        const n = Number(c.value.replace(/[$,]/g, ""));
        if (Number.isNaN(n) || n <= threshold) continue;
        targets.push({ targetKey: c.key, field: kind, oldValue: c.value });
      }
    }
    const unique = new Map(targets.map((t) => [`${t.targetKey}:${t.field}`, t]));
    const created = [];
    for (const t of unique.values()) {
      created.push(
        await db.correction.create({
          data: {
            organizationId: orgId,
            proposedById: userId,
            targetKey: t.targetKey,
            field: t.field,
            oldValue: t.oldValue,
            newValue: "EXCLUDE",
            reason: `NL action: flag all ${field} over $${threshold}`,
            status: "open",
          },
        }),
      );
    }
    return { summary: { flagged: created.length }, corrections: created.map((c) => ({ id: c.id, targetKey: c.targetKey })) };
  }

  if (action === "alert") {
    const numMatch = (params.group ?? "").match(NUM_RE) ?? null;
    const threshold = numMatch ? Number(numMatch[1].replace(/,/g, "")) : 0;
    const parsed = validateAlertRule({ metric: "margin", op: "<", threshold, channel: "inapp", pack });
    if (!parsed.ok) return { summary: { error: parsed.error } };
    const rule = await db.alertRule.create({
      data: {
        orgId,
        pack,
        metric: parsed.value.metric,
        op: parsed.value.op,
        threshold: parsed.value.threshold,
        channel: parsed.value.channel,
      },
    });
    return { summary: { alertId: rule.id, note: "fires when group margin drops below the threshold (0 = negative margin)" } };
  }

  if (action === "rerun") {
    if (pack === "agency") {
      cacheBust(`answer:agency:${orgId}:`);
      const answer = await getAgencyAnswer(orgId, await orgWeekStartsOn(orgId), anchor);
      return { summary: { totals: answer.totals, week: answer.meta.weekStart } };
    }
    cacheBust(`answer:freight:${orgId}:`);
    const answer = await getWeeklyAnswer(orgId, await orgWeekStartsOn(orgId), anchor);
    return { summary: { totals: answer.totals, week: answer.meta.weekStart } };
  }

  if (action === "export") {
    const qs = new URLSearchParams({ week: anchor });
    if (pack === "agency") qs.set("pack", "agency");
    return { summary: { url: `/api/answers/export?${qs}` } };
  }

  const invite = await db.membership.findFirst({ where: { organizationId: orgId, user: { email: params.email } } });
  if (invite) return { summary: { note: `${params.email} is already a member` } };
  return {
    summary: { draft: true, email: params.email, role: params.role ?? "VIEWER", note: "confirm at /settings → Team (invite form) — nothing sent yet" },
  };
}

async function orgWeekStartsOn(orgId: string): Promise<number> {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { weekStartsOn: true, settings: true } });
  if (!org) return 1;
  const settings = (org.settings ?? {}) as { agencyWeekStartsOn?: number };
  return packEnabled(settings, "agency") && settings.agencyWeekStartsOn !== undefined ? settings.agencyWeekStartsOn : org.weekStartsOn;
}
