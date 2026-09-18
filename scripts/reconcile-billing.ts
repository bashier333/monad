import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key) {
    console.log("reconcile-billing: STRIPE_SECRET_KEY required.");
    process.exit(0);
  }
  const stripe = new Stripe(key);
  const subs = await db.subscription.findMany();
  let mismatches = 0;
  for await (const s of stripe.subscriptions.list({ limit: 100, status: "all" })) {
    const orgId = s.metadata?.organizationId;
    if (!orgId) {
      console.log(`ORPHAN stripe sub ${s.id} (no org metadata)`);
      mismatches++;
      continue;
    }
    const row = subs.find((r) => r.organizationId === orgId);
    const wantTier = s.status === "active" || s.status === "trialing" ? "team" : "free";
    if (!row || row.tier !== wantTier || row.status !== s.status) {
      console.log(`MISMATCH org=${orgId} db=${row?.tier}/${row?.status} stripe=${wantTier}/${s.status}`);
      mismatches++;
    }
  }
  const mrr = subs.filter((s) => s.tier !== "free" && s.status === "active").length;
  console.log(`done. active-paid orgs=${mrr} mismatches=${mismatches}`);
  console.log("revenue split: single Team price today — per-pack split lands when pack prices diverge (see PACK_PRICES).");
  await db.$disconnect();
  if (mismatches > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
