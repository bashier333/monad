import Stripe from "stripe";
import { getEnv } from "@/lib/core/env";
import { db } from "@/lib/core/db";

export type Tier = "free" | "team" | "scale";

// Pricing decision (P-221): flat Team price v1. Seats are metered (kind=seat on invite) but
// not billed. Revisit per-seat vs flat at 10 paying teams using meter data + finance export.

export const FREE_LIMITS = {
  uploadsPerMonth: 10,
  historyDays: 90,
};

export const READ_ONLY_AFTER_DAYS = 21;

let stripe: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (stripe !== undefined) return stripe;
  const key = getEnv().STRIPE_SECRET_KEY;
  if (!key) {
    stripe = null;
    return stripe;
  }
  stripe = new Stripe(key);
  return stripe;
}

export interface SubState {
  tier: Tier;
  status: string;
  readOnly: boolean;
}

export async function getSubscription(organizationId: string) {
  return db.subscription.upsert({
    where: { organizationId },
    update: {},
    create: { organizationId, tier: "free", status: "active" },
  });
}

export function toSubState(sub: { tier: string; status: string; statusChangedAt: Date }, now = new Date()): SubState {
  const tier = (sub.tier === "team" || sub.tier === "scale" ? sub.tier : "free") as Tier;
  if (tier !== "free") return { tier, status: sub.status, readOnly: false };
  if (sub.status === "past_due") {
    const days = (now.getTime() - sub.statusChangedAt.getTime()) / 86_400_000;
    return { tier, status: sub.status, readOnly: days >= READ_ONLY_AFTER_DAYS };
  }
  return { tier, status: sub.status, readOnly: false };
}

export function historyAllowed(sub: SubState, weekStartISO: string, now = new Date()): boolean {
  if (sub.tier !== "free") return true;
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - FREE_LIMITS.historyDays);
  return weekStartISO >= cutoff.toISOString().slice(0, 10);
}

export async function monthlyUploads(organizationId: string, now = new Date()): Promise<number> {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return db.meterEvent.aggregate({
    where: { organizationId, kind: "upload", createdAt: { gte: start } },
    _sum: { qty: true },
  }).then((r) => r._sum.qty ?? 0);
}

export async function recordUsage(organizationId: string, kind: string, qty = 1, pack = "freight"): Promise<void> {
  await db.meterEvent.create({ data: { organizationId, kind, qty, pack } });
}
