import { NextResponse } from "next/server";
import { getSubscription, historyAllowed, toSubState } from "@/lib/core/billing";

export async function requireWritable(organizationId: string): Promise<NextResponse | null> {
  const sub = await getSubscription(organizationId);
  if (toSubState(sub).readOnly) {
    return NextResponse.json(
      { error: "account past due — update payment to keep making changes. Your data is safe." },
      { status: 402 },
    );
  }
  return null;
}

export async function historyBlocked(organizationId: string, weekStartISO: string): Promise<boolean> {
  const sub = await getSubscription(organizationId);
  return !historyAllowed(toSubState(sub), weekStartISO);
}
