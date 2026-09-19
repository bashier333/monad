import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "billing:manage");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!process.env.REDIS_URL) {
    return NextResponse.json({ mode: "in-process", waiting: 0, active: 0, failed: 0, note: "no Redis — jobs run inline" });
  }
  const { Queue } = await import("bullmq");
  const queue = new Queue("imports", { connection: { url: process.env.REDIS_URL } });
  const counts = await queue.getJobCounts("waiting", "active", "failed", "delayed");
  await queue.close();
  return NextResponse.json({ mode: "bullmq", ...counts });
}
