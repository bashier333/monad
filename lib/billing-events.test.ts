import { planSubscriptionUpdate, summarizeCorrections } from "@/lib/billing-events";
import { describe, expect, it } from "vitest";

describe("billing event planner (W1)", () => {
  it("ignores events without org metadata (never writes)", () => {
    expect(planSubscriptionUpdate("checkout.session.completed", {})).toBeNull();
    expect(planSubscriptionUpdate("invoice.payment_failed", { metadata: {} })).toBeNull();
  });

  it("maps each event type to the exact tier/status write", () => {
    const org = { metadata: { organizationId: "o1" } };
    expect(planSubscriptionUpdate("checkout.session.completed", org)).toMatchObject({ update: { tier: "team", status: "active" } });
    expect(planSubscriptionUpdate("customer.subscription.updated", { ...org, status: "trialing" })).toMatchObject({ update: { tier: "team" } });
    expect(planSubscriptionUpdate("customer.subscription.updated", { ...org, status: "past_due" })).toMatchObject({ update: { tier: "free", status: "past_due" } });
    expect(planSubscriptionUpdate("customer.subscription.deleted", org)).toMatchObject({ update: { tier: "free", status: "canceled" } });
    expect(planSubscriptionUpdate("invoice.payment_failed", org)).toMatchObject({ update: { tier: "free", status: "past_due" } });
    expect(planSubscriptionUpdate("invoice.payment_succeeded", org)).toMatchObject({ update: { tier: "free", status: "active" } });
    expect(planSubscriptionUpdate("charge.refunded", org)).toBeNull();
  });

  it("stale completed events can't downgrade (caller applies newest-wins)", () => {
    const first = planSubscriptionUpdate("invoice.payment_failed", { metadata: { organizationId: "o" } });
    const second = planSubscriptionUpdate("invoice.payment_succeeded", { metadata: { organizationId: "o" } });
    expect(first?.update.status).toBe("past_due");
    expect(second?.update.status).toBe("active");
  });

  it("summarizes corrections without NaN on empty orgs", () => {
    expect(summarizeCorrections([], 0)).toEqual({ byStatus: {}, total: 0, pctBecomingRules: null });
    expect(summarizeCorrections([{ status: "applied", _count: 4 }], 1)).toMatchObject({ total: 4, pctBecomingRules: 25 });
  });
});
