import { db } from "@/lib/core/db";
import type { Prisma } from "@prisma/client";
import {
  orderAutomations,
  validateAutomationSpec,
  type AutomationSpec,
} from "@/lib/core/automations/spec";
import { recordEvent } from "@/lib/core/ontology/facts";

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toSpec(row: {
  key: string;
  name: string;
  trigger: unknown;
  effects: unknown;
  maxRetries: number;
  backoff: string;
  paused: boolean;
  mutedUntilMs: bigint | number | null;
  expiresAtMs: bigint | number | null;
  throttlePerHour: number | null;
  dependsOn: unknown;
  enabled: boolean;
}): AutomationSpec {
  return {
    key: row.key,
    name: row.name,
    trigger: row.trigger as AutomationSpec["trigger"],
    effects: row.effects as AutomationSpec["effects"],
    maxRetries: row.maxRetries,
    backoff: row.backoff === "constant" ? "constant" : "exponential",
    paused: row.paused,
    ...(row.mutedUntilMs != null ? { mutedUntilMs: Number(row.mutedUntilMs) } : {}),
    ...(row.expiresAtMs != null ? { expiresAtMs: Number(row.expiresAtMs) } : {}),
    ...(row.throttlePerHour != null ? { throttlePerHour: row.throttlePerHour } : {}),
    dependsOn: (Array.isArray(row.dependsOn) ? row.dependsOn : []) as string[],
    enabled: row.enabled,
  };
}

export async function defineAutomation(organizationId: string, createdById: string, input: unknown) {
  const parsed = validateAutomationSpec(input);
  if (!parsed.ok) return parsed;
  const existing = await db.automation.findUnique({
    where: { organizationId_key: { organizationId, key: parsed.value.key } },
  });
  if (existing) {
    return { ok: false as const, problems: [{ field: "key", message: "automation key already exists" }] };
  }
  const created = await db.automation.create({
    data: {
      organizationId,
      key: parsed.value.key,
      name: parsed.value.name,
      trigger: json(parsed.value.trigger),
      effects: json(parsed.value.effects),
      maxRetries: parsed.value.maxRetries,
      backoff: parsed.value.backoff,
      paused: parsed.value.paused,
      mutedUntilMs: parsed.value.mutedUntilMs ?? null,
      expiresAtMs: parsed.value.expiresAtMs ?? null,
      throttlePerHour: parsed.value.throttlePerHour ?? null,
      dependsOn: json(parsed.value.dependsOn),
      enabled: parsed.value.enabled,
      createdById,
    },
  });
  await recordEvent(organizationId, {
    kind: "ontology:automation:defined",
    actorId: createdById,
    after: { key: created.key },
  });
  return { ok: true as const, value: created };
}

export async function listAutomations(organizationId: string) {
  const rows = await db.automation.findMany({
    where: { organizationId },
    orderBy: { key: "asc" },
    take: 500,
  });
  return rows.map(toSpec);
}

export async function listDueAutomations(organizationId: string): Promise<AutomationSpec[]> {
  const rows = await db.automation.findMany({
    where: { organizationId, enabled: true, paused: false },
    orderBy: { key: "asc" },
    take: 500,
  });
  const now = Date.now();
  const due = rows.map(toSpec).filter((s) => {
    if (s.expiresAtMs != null && now >= s.expiresAtMs) return false;
    if (s.mutedUntilMs != null && now < s.mutedUntilMs) return false;
    return true;
  });
  return orderAutomations(due);
}

export async function setAutomationPaused(
  organizationId: string,
  createdById: string,
  key: string,
  paused: boolean,
) {
  const current = await db.automation.findUnique({
    where: { organizationId_key: { organizationId, key } },
  });
  if (!current) return { ok: false as const, error: "unknown automation" };
  const updated = await db.automation.update({
    where: { id: current.id },
    data: { paused },
  });
  await recordEvent(organizationId, {
    kind: paused ? "ontology:automation:paused" : "ontology:automation:resumed",
    actorId: createdById,
    after: { key },
  });
  return { ok: true as const, value: updated };
}

export async function recordAutomationRun(
  organizationId: string,
  pack: string,
  record: { automationKey: string; trigger: string; status: string; effects: unknown },
) {
  await db.eventLog.create({
    data: {
      type: "automation.fired",
      orgId: organizationId,
      pack,
      payload: { ...record } as never,
      status: record.status === "ok" ? "ok" : "error",
    },
  });
  await db.automation.updateMany({
    where: { organizationId, key: record.automationKey },
    data: { lastFiredAt: new Date() },
  });
}

export async function automationHistory(organizationId: string, take = 50) {
  return db.eventLog.findMany({
    where: { orgId: organizationId, type: "automation.fired" },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(take, 1), 200),
  });
}

export async function recentAutomationFires(
  organizationId: string,
  key: string,
  sinceMs: number,
): Promise<number[]> {
  const rows = await db.eventLog.findMany({
    where: { orgId: organizationId, type: "automation.fired", createdAt: { gte: new Date(sinceMs) } },
    select: { createdAt: true, payload: true },
    take: 1000,
  });
  return rows
    .filter((r) => (r.payload as { automationKey?: string } | null)?.automationKey === key)
    .map((r) => r.createdAt.getTime());
}
