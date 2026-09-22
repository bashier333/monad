import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireJson } from "@/lib/core/json-guard";

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "billing:manage");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const guardedJson1 = requireJson(req);
  if (!guardedJson1.ok) return guardedJson1.response;
  const body = (await req.json()) as {
    anomalyThresholdPts?: number;
    weekStartsOn?: number;
    timezone?: string;
    locale?: string;
    anomalyEmail?: boolean;
    anomalyOverrides?: Record<string, number>;
    anomalySuppressed?: string[];
    fleetSize?: string;
    teamSize?: string;
    agencyWeekStartsOn?: number;
    agencyAnomalyThresholdPts?: number;
    agencyAnomalyEmail?: boolean;
    agencyAnomalyOverrides?: Record<string, number>;
    agencyAnomalySuppressed?: string[];
    enabledPacks?: string[];
    featureFlags?: unknown;
    storageQuotaBytes?: number;
    predictOptOut?: boolean;
    crossOrgOptOut?: boolean;
    hookSecret?: string;
    hookSources?: unknown;
  };
  const settings = (active.organization.settings ?? {}) as Record<string, unknown>;
  if (body.anomalyThresholdPts !== undefined) {
    const n = Number(body.anomalyThresholdPts);
    if (!Number.isFinite(n) || n < 1 || n > 50) {
      return NextResponse.json({ error: "anomalyThresholdPts must be 1–50" }, { status: 400 });
    }
    settings.anomalyThresholdPts = n;
  }
  const data: { settings?: object; weekStartsOn?: number; timezone?: string } = { settings };
  if (body.weekStartsOn !== undefined) {
    const n = Number(body.weekStartsOn);
    if (!Number.isInteger(n) || n < 0 || n > 6) {
      return NextResponse.json({ error: "weekStartsOn must be 0–6" }, { status: 400 });
    }
    data.weekStartsOn = n;
  }
  if (body.timezone !== undefined) data.timezone = String(body.timezone).slice(0, 64);
  if (body.anomalyEmail !== undefined) settings.anomalyEmail = body.anomalyEmail === true;
  if (body.anomalyOverrides !== undefined && typeof body.anomalyOverrides === "object") {
    const clean: Record<string, number> = {};
    for (const [k, v] of Object.entries(body.anomalyOverrides)) {
      if (typeof v === "number" && v >= 1 && v <= 50 && k.length <= 120) clean[k] = v;
    }
    settings.anomalyOverrides = clean;
  }
  if (Array.isArray(body.anomalySuppressed)) {
    settings.anomalySuppressed = body.anomalySuppressed.filter((s) => typeof s === "string").slice(0, 100);
  }
  if (typeof body.fleetSize === "string" && ["owner-op", "small", "mid", "large"].includes(body.fleetSize)) {
    settings.fleetSize = body.fleetSize;
  }
  if (typeof body.teamSize === "string" && ["solo", "small", "mid", "large"].includes(body.teamSize)) {
    settings.teamSize = body.teamSize;
  }
  if (body.agencyWeekStartsOn !== undefined) {
    const n = Number(body.agencyWeekStartsOn);
    if (!Number.isInteger(n) || n < 0 || n > 6) {
      return NextResponse.json({ error: "agencyWeekStartsOn must be 0–6" }, { status: 400 });
    }
    settings.agencyWeekStartsOn = n;
  }
  if (body.agencyAnomalyThresholdPts !== undefined) {
    const n = Number(body.agencyAnomalyThresholdPts);
    if (!Number.isFinite(n) || n < 1 || n > 50) {
      return NextResponse.json({ error: "agencyAnomalyThresholdPts must be 1–50" }, { status: 400 });
    }
    settings.agencyAnomalyThresholdPts = n;
  }
  if (body.agencyAnomalyEmail !== undefined) settings.agencyAnomalyEmail = body.agencyAnomalyEmail === true;
  if (body.agencyAnomalyOverrides !== undefined && typeof body.agencyAnomalyOverrides === "object") {
    const clean: Record<string, number> = {};
    for (const [k, v] of Object.entries(body.agencyAnomalyOverrides)) {
      if (typeof v === "number" && v >= 1 && v <= 50 && k.length <= 120) clean[k] = v;
    }
    settings.agencyAnomalyOverrides = clean;
  }
  if (Array.isArray(body.agencyAnomalySuppressed)) {
    settings.agencyAnomalySuppressed = body.agencyAnomalySuppressed.filter((s) => typeof s === "string").slice(0, 100);
  }
  if (Array.isArray(body.enabledPacks)) {
    const allowed = ["freight", "agency"];
    const clean = body.enabledPacks.filter((p) => allowed.includes(p));
    if (clean.length === 0) {
      return NextResponse.json({ error: "enabledPacks must include at least one pack" }, { status: 400 });
    }
    settings.enabledPacks = clean;
  }
  if (body.locale !== undefined) {
    const { isLocale } = await import("@/lib/core/i18n");
    if (!isLocale(String(body.locale))) {
      return NextResponse.json({ error: "locale must be en|es|de" }, { status: 400 });
    }
    settings.locale = body.locale;
  }
  if (body.featureFlags !== undefined) {
    const { validateFlags } = await import("@/lib/core/flags");
    const parsed = validateFlags(body.featureFlags);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    settings.featureFlags = parsed.flags;
  }
  if (body.storageQuotaBytes !== undefined) {
    const n = Number(body.storageQuotaBytes);
    if (!Number.isInteger(n) || n < 0) {
      return NextResponse.json({ error: "storageQuotaBytes must be a non-negative integer" }, { status: 400 });
    }
    settings.storageQuotaBytes = n;
  }
  if (body.predictOptOut !== undefined) settings.predictOptOut = body.predictOptOut === true;
  if (body.crossOrgOptOut !== undefined) settings.crossOrgOptOut = body.crossOrgOptOut === true;
  if (body.hookSecret !== undefined) {
    const s = String(body.hookSecret).slice(0, 128);
    if (s.length > 0 && s.length < 16) {
      return NextResponse.json({ error: "hookSecret must be empty (disable) or ≥16 chars" }, { status: 400 });
    }
    if (s.length === 0) delete settings.hookSecret;
    else settings.hookSecret = s;
  }
  if (body.hookSources !== undefined && typeof body.hookSources === "object" && body.hookSources !== null) {
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.hookSources as Record<string, unknown>)) {
      if ((v === "freight" || v === "agency") && k.length <= 80) clean[k] = v;
    }
    settings.hookSources = clean;
  }

  const updated = await db.organization.update({
    where: { id: active.organization.id },
    data,
    select: { weekStartsOn: true, timezone: true, settings: true },
  });
  await logAccess(active.organization.id, session.user.id, "org:settings", Object.keys(data.settings ?? {}).join(","));
  return NextResponse.json({ settings: updated });
}
