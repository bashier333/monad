import { NextResponse } from "next/server";
import { getStripe, getSubscription } from "@/lib/billing";
import { buildCheckoutParams } from "@/lib/billing-checkout";
import { getEnv } from "@/lib/env";
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
  const priceId = getEnv().STRIPE_TEAM_PRICE_ID || process.env.NEXT_PUBLIC_STRIPE_TEAM_PRICE_ID || "";
  if (!stripe || !priceId) {
    return NextResponse.json({ error: "billing not configured (missing Stripe key or price)" }, { status: 501 });
  }

  const sub = await getSubscription(active.organization.id);
  let customerId = sub.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email ?? undefined,
      metadata: { organizationId: active.organization.id },
    });
    customerId = customer.id;
    await getSubscription(active.organization.id).then(() => null);
    const { db } = await import("@/lib/db");
    await db.subscription.update({
      where: { organizationId: active.organization.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const origin = new URL(req.url).origin;
  const body = (await req.json().catch(() => ({}))) as {
    trialDays?: number;
    couponId?: string;
    taxExempt?: boolean;
  };
  const trialDays = Math.min(Math.max(Number(body.trialDays ?? 0), 0), 30);
  const checkout = await stripe.checkout.sessions.create(
    buildCheckoutParams({
      priceId,
      customerId,
      organizationId: active.organization.id,
      origin,
      trialDays,
      couponId: typeof body.couponId === "string" && body.couponId ? body.couponId.slice(0, 64) : undefined,
      taxExempt: body.taxExempt === true,
    }),
  );
  return NextResponse.json({ url: checkout.url });
}
