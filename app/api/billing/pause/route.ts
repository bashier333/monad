import { NextResponse } from "next/server";
import { getStripe } from "@/lib/core/billing";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireJson } from "@/lib/core/json-guard";

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

  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "billing not configured" }, { status: 501 });
  const sub = await db.subscription.findUnique({ where: { organizationId: active.organization.id } });
  if (!sub?.stripeSubId) return NextResponse.json({ error: "no active subscription to pause" }, { status: 409 });

  const guardedJson1 = requireJson(req);
  if (!guardedJson1.ok) return guardedJson1.response;
  const body = (await req.json().catch(() => ({}))) as { resume?: boolean };
  if (body.resume === true) {
    await stripe.subscriptions.update(sub.stripeSubId, { pause_collection: "" });
  } else {
    await stripe.subscriptions.update(sub.stripeSubId, { pause_collection: { behavior: "mark_uncollectible" } });
  }
  await logAccess(active.organization.id, session.user.id, body.resume === true ? "billing:resume" : "billing:pause", sub.stripeSubId);
  return NextResponse.json({ ok: true, paused: body.resume !== true });
}
