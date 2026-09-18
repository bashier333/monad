import { NextResponse } from "next/server";
import { getStripe, getSubscription } from "@/lib/billing";
import { auth } from "@/lib/auth";
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
  const sub = await getSubscription(active.organization.id);
  if (!stripe || !sub.stripeCustomerId) {
    return NextResponse.json({ error: "no billing account yet — subscribe first" }, { status: 409 });
  }

  const origin = new URL(req.url).origin;
  const portal = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${origin}/settings`,
  });
  return NextResponse.json({ url: portal.url });
}
