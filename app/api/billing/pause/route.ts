import { NextResponse } from "next/server";
import { getStripe } from "@/lib/billing";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAccess } from "@/lib/access";
import { getActiveOrg } from "@/lib/org";
import { requireCan } from "@/lib/roles";

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

  const body = (await req.json().catch(() => ({}))) as { resume?: boolean };
  if (body.resume === true) {
    await stripe.subscriptions.update(sub.stripeSubId, { pause_collection: "" });
  } else {
    await stripe.subscriptions.update(sub.stripeSubId, { pause_collection: { behavior: "mark_uncollectible" } });
  }
  await logAccess(active.organization.id, session.user.id, body.resume === true ? "billing:resume" : "billing:pause", sub.stripeSubId);
  return NextResponse.json({ ok: true, paused: body.resume !== true });
}
