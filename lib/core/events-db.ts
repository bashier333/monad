import type { DomainEvent, EventSink } from "@/lib/core/events";
import { db } from "@/lib/core/db";

export const dbEventSink: EventSink = {
  async persist(event: DomainEvent) {
    await db.eventLog.create({
      data: {
        id: event.id,
        type: event.type,
        version: event.version,
        orgId: event.orgId,
        pack: event.pack,
        payload: event.payload as unknown as object,
      },
    });
  },
  async markDead(eventId: string, attempts: number) {
    await db.eventLog.update({
      where: { id: eventId },
      data: { status: "dead", attempts },
    });
  },
  async endpoints(orgId: string) {
    const rows = await db.webhookEndpoint.findMany({ where: { orgId, active: true } });
    return rows.map((r) => ({
      url: r.url,
      secret: r.secret,
      events: (r.events as string[]) ?? [],
    }));
  },
};

export async function recordEvent(
  type: Parameters<typeof import("@/lib/core/events").publishEvent>[0],
  orgId: string,
  pack: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const { publishEvent } = await import("@/lib/core/events");
    await publishEvent(type, orgId, pack, payload, dbEventSink);
  } catch (e) {
    const { logger } = await import("@/lib/core/logger");
    logger.warn("event publish failed (non-fatal)", { type, orgId, error: e instanceof Error ? e.message : String(e) });
  }
}
