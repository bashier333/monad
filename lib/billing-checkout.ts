import type Stripe from "stripe";

export interface CheckoutOptions {
  priceId: string;
  customerId: string;
  organizationId: string;
  origin: string;
  trialDays?: number;
  couponId?: string;
  annual?: boolean;
  taxExempt?: boolean;
}

// NOTE: annual billing = a separate annual price ID passed as priceId (kept explicit so the
// dashboard price and the charged price can't drift).

export function buildCheckoutParams(o: CheckoutOptions): Stripe.Checkout.SessionCreateParams {
  if (!o.priceId) throw new Error("priceId is required");
  return {
    customer: o.customerId,
    mode: "subscription" as const,
    line_items: [{ price: o.priceId, quantity: 1 }],
    success_url: `${o.origin}/settings?billing=success`,
    cancel_url: `${o.origin}/settings?billing=cancelled`,
    metadata: { organizationId: o.organizationId },
    ...(o.trialDays && o.trialDays > 0 ? { subscription_data: { trial_period_days: o.trialDays } } : {}),
    ...(o.couponId ? { discounts: [{ coupon: o.couponId }] } : {}),
    automatic_tax: { enabled: true },
    ...(o.taxExempt ? { customer_update: { address: "auto" as const }, tax_id_collection: { enabled: true } } : {}),
  };
}
