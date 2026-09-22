import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireJson } from "@/lib/core/json-guard";

const REASONS = ["too-expensive", "missing-feature", "switched-tool", "paused-ops", "other"] as const;

export async function POST(req: Request) {
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
  const body = (await req.json().catch(() => ({}))) as { reason?: string };
  const reason = REASONS.includes(body.reason as (typeof REASONS)[number]) ? String(body.reason) : "other";
  await logAccess(active.organization.id, session.user.id, "billing:cancel-survey", reason);
  return NextResponse.json({ ok: true });
}
