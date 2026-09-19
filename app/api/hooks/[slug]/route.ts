import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { makeEvent, fanOut, type EventType } from "@/lib/core/events";
import { db } from "@/lib/core/db";

const MAX_BODY = 256_000;

function verifySignature(secret: string, body: string, provided: string | null): boolean {
  if (!provided) return false;
  const bearer = provided.startsWith("Bearer ") ? provided.slice(7) : null;
  if (bearer && bearer === secret) return true;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await db.organization.findUnique({ where: { slug } });
  if (!org) return NextResponse.json({ error: "unknown receiver" }, { status: 404 });
  const settings = (org.settings ?? {}) as { hookSecret?: string; hookSources?: Record<string, string> };
  if (!settings.hookSecret) {
    return NextResponse.json({ error: "inbound webhooks not enabled for this org" }, { status: 403 });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: "payload too large" }, { status: 413 });
  if (!verifySignature(settings.hookSecret, raw, req.headers.get("x-hook-signature"))) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "payload must be JSON" }, { status: 400 });
  }
  const p = payload as { source?: string; rows?: unknown; idempotencyKey?: string };
  if (typeof p.source !== "string" || !Array.isArray(p.rows)) {
    await db.eventLog.create({
      data: { type: "webhook.inbound", version: 1, orgId: org.id, pack: "freight", payload: { raw: raw.slice(0, 2000) } as unknown as object, status: "dead", attempts: 3 },
    });
    return NextResponse.json({ error: "payload needs {source, rows[]} — quarantined, nothing imported" }, { status: 400 });
  }

  const idemKey = typeof p.idempotencyKey === "string" ? p.idempotencyKey : null;
  if (idemKey) {
    const dup = await db.eventLog.findFirst({
      where: { orgId: org.id, type: "webhook.inbound", payload: { path: ["idempotencyKey"], equals: idemKey } },
    });
    if (dup) return NextResponse.json({ ok: true, replay: true, eventId: dup.id });
  }

  const allowed = settings.hookSources ?? {};
  const pack = allowed[p.source] ?? "freight";
  const event = makeEvent("webhook.inbound" as EventType, org.id, pack, {
    source: p.source,
    rows: (p.rows as unknown[]).length,
    ...(idemKey ? { idempotencyKey: idemKey } : {}),
  });
  await db.eventLog.create({
    data: { id: event.id, type: event.type, version: event.version, orgId: event.orgId, pack, payload: event.payload as unknown as object },
  });
  const { dbEventSink } = await import("@/lib/core/events-db");
  await fanOut(event, dbEventSink);
  return NextResponse.json({ ok: true, eventId: event.id, rows: (p.rows as unknown[]).length });
}
