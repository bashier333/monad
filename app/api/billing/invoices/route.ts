import { NextResponse } from "next/server";
import { getStripe, getSubscription } from "@/lib/core/billing";
import { auth } from "@/lib/core/auth";
import { getActiveOrg } from "@/lib/core/org";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });

  const stripe = getStripe();
  const sub = await getSubscription(active.organization.id);
  if (!stripe || !sub.stripeCustomerId) return NextResponse.json({ invoices: [] });

  const list = await stripe.invoices.list({ customer: sub.stripeCustomerId, limit: 12 });
  return NextResponse.json({
    invoices: list.data.map((inv) => ({
      id: inv.id,
      amount: (inv.amount_due ?? 0) / 100,
      currency: inv.currency,
      status: inv.status,
      date: new Date((inv.created ?? 0) * 1000).toISOString().slice(0, 10),
      receipt: inv.receipt_number ?? null,
      pdf: inv.invoice_pdf ?? null,
    })),
  });
}
