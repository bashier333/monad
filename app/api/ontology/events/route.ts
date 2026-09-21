import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";

// Audit event table source: hash-chained events with optional object filter.
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(userId);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  const { searchParams } = new URL(req.url);
  const objectId = searchParams.get("objectId") ?? undefined;
  const take = Math.min(Math.max(Number(searchParams.get("take") ?? 100), 1), 500);
  const events = await db.ontoEvent.findMany({
    where: { organizationId: active.organization.id, ...(objectId ? { objectId } : {}) },
    orderBy: { createdAt: "desc" },
    take,
  });
  return NextResponse.json({
    events: events.map((e) => ({
      id: e.id,
      kind: e.kind,
      objectId: e.objectId,
      actorId: e.actorId,
      before: e.before,
      after: e.after,
      prevHash: e.prevHash,
      hash: e.hash,
      createdAt: e.createdAt.toISOString(),
    })),
  });
}
