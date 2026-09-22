// Automation production wiring: db-backed tick dependencies registered at
// worker startup. Scripts can import packs; core never does (boundary rule).
import { db } from "../lib/core/db";
import { notifyOrg } from "../lib/core/notify";
import { executeAction } from "../lib/core/ontology/execute";
import { executeStoredFunction } from "../lib/core/ontology/functions-store";
import { allNativeHandlers } from "../lib/packs/function-handlers";
import { listDueAutomations, recordAutomationRun } from "../lib/core/automations/store";
import { runAutomationTick, type TickDeps } from "../lib/core/automations/tick";
import type { RunRecord } from "../lib/core/automations/runner";

export function automationTickDeps(orgId: string, pack: string): TickDeps {
  return {
    listSpecs: () => listDueAutomations(orgId),
    getRows: async (spec) => {
      if (spec.trigger.kind !== "condition") return [];
      const field = spec.trigger.field;
      void field;
      const rows = await db.ontoObject.findMany({
        where: { organizationId: orgId, deletedAt: null },
        select: { key: true, typeKey: true, data: true },
        take: 2000,
      });
      return rows.map((r) => ({ id: r.key, type: r.typeKey, ...(r.data as Record<string, unknown>) }));
    },
    recentFiredAtMs: async (specKey) => {
      const { recentAutomationFires } = await import("../lib/core/automations/store");
      return recentAutomationFires(orgId, specKey, Date.now() - 3600_000);
    },
    runners: {
      runAction: async (actionKey, args, objectId) => {
        if (!objectId) return { ok: false, error: "action effect needs an explicit objectId" };
        const target = await db.ontoObject.findFirst({
          where: { id: objectId, organizationId: orgId, deletedAt: null },
          select: { id: true },
        });
        if (!target) return { ok: false, error: "action target not found in org" };
        const action = await db.ontoAction.findUnique({
          where: { organizationId_key: { organizationId: orgId, key: actionKey } },
        });
        if (!action) return { ok: false, error: `unknown action ${actionKey}` };
        const res = await executeAction(orgId, "worker:automation", {
          actionKey,
          objectId: target.id,
          inputs: args,
          idempotencyKey: `auto:${actionKey}:${Date.now()}`,
        });
        return res.ok ? { ok: true } : { ok: false, error: res.error };
      },
      runFunction: async (key, args) => {
        const res = await executeStoredFunction(orgId, key, args, { nativeHandlers: allNativeHandlers });
        return res.ok ? { ok: true, value: res.value } : { ok: false, error: res.error };
      },
      notify: async (message, href) => {
        await notifyOrg(orgId, "automation", message, href ?? "/ontology/ops");
      },
    },
    recordRun: async (record: RunRecord) => {
      await recordAutomationRun(orgId, pack, {
        automationKey: record.automationKey,
        trigger: record.trigger,
        status: record.status,
        effects: record.effects,
      });
    },
  };
}

export async function runAutomationTickForOrg(orgId: string, pack: string, now = new Date()) {
  return runAutomationTick(now, automationTickDeps(orgId, pack));
}
