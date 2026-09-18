import { NextResponse } from "next/server";
import { FREE_LIMITS, getSubscription, monthlyUploads, toSubState } from "@/lib/billing";
import { auth } from "@/lib/auth";
import { getActiveOrg } from "@/lib/org";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });

  const sub = await getSubscription(active.organization.id);
  const state = toSubState(sub);
  const uploads = await monthlyUploads(active.organization.id);
  return NextResponse.json({
    tier: state.tier,
    status: state.status,
    readOnly: state.readOnly,
    limits: FREE_LIMITS,
    usage: { uploadsThisMonth: uploads },
  });
}
