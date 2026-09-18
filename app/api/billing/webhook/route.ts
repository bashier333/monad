import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/billing";
import { planSubscriptionUpdate } from "@/lib/billing-events";
import { getEnv } from "@/lib/env";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { stampConversion } from "@/lib/pilots";

export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = getEnv().STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "billing not configured" }, { status: 501 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "missing signature" }, { status: 400 });
  const requestId = req.headers.get("x-request-id") ?? "webhook";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), sig, secret);
  } catch {
    logger.warn("billing: webhook bad signature", { requestId });
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  const orgIdOf = (o: object) => (o as { metadata?: { organizationId?: string } }).metadata?.organizationId;

  const applyPlanned = async (planned: { orgId: string; update: { tier: "team" | "free"; status: string } }) => {
    await db.subscription.update({
      where: { organizationId: planned.orgId },
      data: { ...planned.update, statusChangedAt: new Date() },
    });
  };

  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session;
    const planned = planSubscriptionUpdate(event.type, {
      status: undefined,
      metadata: { organizationId: orgIdOf(s) },
    });
    if (planned && typeof s.subscription === "string") {
      await db.subscription.update({
        where: { organizationId: planned.orgId },
        data: { tier: "team", status: "active", stripeSubId: s.subscription, statusChangedAt: new Date() },
      });
      await stampConversion(planned.orgId);
      logger.info("billing: team activated", { requestId, orgId: planned.orgId });
    }
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const s = event.data.object as Stripe.Subscription;
    const planned = planSubscriptionUpdate(event.type, {
      status: event.type === "customer.subscription.deleted" ? "canceled" : s.status,
      metadata: { organizationId: orgIdOf(s) },
    });
    if (planned) {
      await applyPlanned(planned);
      logger.info("billing: subscription changed", { requestId, orgId: planned.orgId, status: planned.update.status });
    }
  }

  if (event.type === "invoice.payment_failed") {
    const inv = event.data.object as Stripe.Invoice;
    const planned = planSubscriptionUpdate(event.type, { metadata: { organizationId: orgIdOf(inv) } });
    if (planned) {
      await applyPlanned(planned);
      logger.info("billing: payment failed, dunning clock started", { requestId, orgId: planned.orgId });
    }
  }

  if (event.type === "invoice.payment_succeeded") {
    const inv = event.data.object as Stripe.Invoice;
    const planned = planSubscriptionUpdate(event.type, { metadata: { organizationId: orgIdOf(inv) } });
    if (planned) await applyPlanned(planned);
  }

  return NextResponse.json({ received: true });
}
