import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";

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

  const body = (await req.json()) as {
    anomalyThresholdPts?: number;
    weekStartsOn?: number;
    timezone?: string;
    anomalyEmail?: boolean;
    anomalyOverrides?: Record<string, number>;
    anomalySuppressed?: string[];
    fleetSize?: string;
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

  const updated = await db.organization.update({
    where: { id: active.organization.id },
    data,
    select: { weekStartsOn: true, timezone: true, settings: true },
  });
  return NextResponse.json({ settings: updated });
}
