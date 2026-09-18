import { buildCheckoutParams } from "@/lib/billing-checkout";
import { describe, expect, it } from "vitest";

const BASE = { priceId: "price_1", customerId: "cus_1", organizationId: "o1", origin: "https://x.test" };

describe("buildCheckoutParams (W6)", () => {
  it("builds a base Team checkout with tax on", () => {
    const p = buildCheckoutParams(BASE);
    expect(p.mode).toBe("subscription");
    expect(p.automatic_tax).toEqual({ enabled: true });
    expect(p.customer_update).toEqual({ address: "auto", name: "auto" });
    expect(p).not.toHaveProperty("subscription_data");
  });

  it("adds trial, coupon, and tax-id collection", () => {
    const p = buildCheckoutParams({ ...BASE, trialDays: 14, couponId: "PILOT50", taxExempt: true });
    expect(p).toMatchObject({
      subscription_data: { trial_period_days: 14 },
      discounts: [{ coupon: "PILOT50" }],
      tax_id_collection: { enabled: true },
    });
  });

  it("requires a price", () => {
    expect(() => buildCheckoutParams({ ...BASE, priceId: "" })).toThrow();
  });
});
