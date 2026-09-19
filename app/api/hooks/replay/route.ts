import { NextResponse } from "next/server";
import { fanOut, type DomainEvent } from "@/lib/core/events";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "upload:import");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await req.json()) as { eventId?: string };
  if (!body.eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });
  const row = await db.eventLog.findFirst({ where: { id: body.eventId, orgId: active.organization.id } });
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  const event: DomainEvent = {
    id: row.id,
    type: row.type as DomainEvent["type"],
    version: row.version,
    orgId: row.orgId,
    pack: row.pack,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    at: row.createdAt.toISOString(),
  };
  const { dbEventSink } = await import("@/lib/core/events-db");
  await fanOut(event, dbEventSink);
  await logAccess(active.organization.id, session.user.id, "hooks:replay", row.id);
  return NextResponse.json({ ok: true, replayed: row.id });
}
