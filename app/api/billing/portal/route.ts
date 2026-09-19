import { NextResponse } from "next/server";
import { getStripe, getSubscription } from "@/lib/core/billing";
import { auth } from "@/lib/core/auth";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";

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
  const sub = await getSubscription(active.organization.id);
  if (!stripe || !sub.stripeCustomerId) {
    return NextResponse.json({ error: "no billing account yet — subscribe first" }, { status: 409 });
  }

  const origin = new URL(req.url).origin;
  const portal = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${origin}/settings`,
  });
  await logAccess(active.organization.id, session.user.id, "billing:portal", "", req.headers.get("x-request-id") ?? "none");
  return NextResponse.json({ url: portal.url });
}
