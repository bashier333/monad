import { NextResponse } from "next/server";
import { getStripe, getSubscription, recordUsage } from "@/lib/core/billing";
import { buildCheckoutParams } from "@/lib/core/billing-checkout";
import { getEnv } from "@/lib/core/env";
import { auth } from "@/lib/core/auth";
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
  const guardedJson1 = requireJson(req);
  if (!guardedJson1.ok) return guardedJson1.response;
  const body0 = (await req.json().catch(() => ({}))) as { annual?: boolean; trialDays?: number; couponId?: string; taxExempt?: boolean };
  // Annual = a separate annual price ID (Stripe has no billing-cycle switch
  // on one price). Unset env means annual checkout isn't offered yet — the
  // pricing page hides the toggle in that case, this 501 is the backstop.
  const annual = body0.annual === true;
  const priceId = annual
    ? process.env.STRIPE_TEAM_ANNUAL_PRICE_ID || ""
    : getEnv().STRIPE_TEAM_PRICE_ID || process.env.NEXT_PUBLIC_STRIPE_TEAM_PRICE_ID || "";
  if (!stripe || !priceId) {
    return NextResponse.json(
      { error: annual ? "annual billing is not enabled yet — monthly checkout works today" : "billing not configured (missing Stripe key or price)" },
      { status: 501 }
    );
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
    const { db } = await import("@/lib/core/db");
    await db.subscription.update({
      where: { organizationId: active.organization.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const origin = new URL(req.url).origin;
  const body = body0;
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
    ...(req.headers.get("Idempotency-Key")
      ? [{ idempotencyKey: req.headers.get("Idempotency-Key") as string }]
      : []),
  );
  await recordUsage(active.organization.id, "checkout");
  await logAccess(active.organization.id, session.user.id, "billing:checkout", String(trialDays), req.headers.get("x-request-id") ?? "none");
  return NextResponse.json({ url: checkout.url });
}
