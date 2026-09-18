export interface PlannedUpdate {
  tier: "team" | "free";
  status: string;
}

export function planSubscriptionUpdate(
  eventType: string,
  obj: { status?: string; metadata?: { organizationId?: string } },
): { orgId: string; update: { tier: "team" | "free"; status: string } } | null {
  const orgId = obj.metadata?.organizationId;
  if (!orgId) return null;

  if (eventType === "checkout.session.completed") {
    return { orgId, update: { tier: "team", status: "active" } };
  }
  if (eventType === "customer.subscription.updated") {
    const status = obj.status ?? "unknown";
    const active = status === "active" || status === "trialing";
    return { orgId, update: { tier: active ? "team" : "free", status } };
  }
  if (eventType === "customer.subscription.deleted") {
    return { orgId, update: { tier: "free", status: "canceled" } };
  }
  if (eventType === "invoice.payment_failed") {
    return { orgId, update: { tier: "free", status: "past_due" } };
  }
  if (eventType === "invoice.payment_succeeded") {
    return { orgId, update: { tier: "free", status: "active" } };
  }
  return null;
}

export function summarizeCorrections(
  grouped: Array<{ status: string; _count: number }>,
  activeRules: number,
): { byStatus: Record<string, number>; total: number; pctBecomingRules: number | null } {
  const byStatus: Record<string, number> = {};
  for (const g of grouped) byStatus[g.status] = g._count;
  const total = Object.values(byStatus).reduce((s, n) => s + n, 0);
  return { byStatus, total, pctBecomingRules: total === 0 ? null : Math.round((activeRules / total) * 10000) / 100 };
}
