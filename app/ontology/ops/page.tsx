import Link from "next/link";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";
import OpsBoards from "@/app/ontology/ops/boards";
import { MANUFACTURING_ACTIONS } from "@/lib/packs/manufacturing/actions";

async function gate() {
  const session = await auth();
  if (!session?.user?.id) return { gate: "signin" as const };
  const active = await getActiveOrg(session.user.id);
  if (!active) return { gate: "noorg" as const };
  return { gate: "ok" as const, orgId: active.organization.id };
}

export default async function OpsPage() {
  const g = await gate();
  if (g.gate !== "ok") {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>
          <Link href="/signin" className="underline">
            Sign in
          </Link>{" "}
          to open ops.
        </p>
      </main>
    );
  }
  const [policies, playbooks, alerts, webhooks] = await Promise.all([
    db.ontoPolicy.findMany({ where: { organizationId: g.orgId }, orderBy: { priority: "asc" }, take: 100 }).catch(() => []),
    db.workflowPlaybook
      .findMany({
        where: { orgId: g.orgId },
        orderBy: { createdAt: "desc" },
        include: { runs: { orderBy: { createdAt: "desc" }, take: 1 } },
      })
      .catch(() => []),
    db.alertRule.findMany({ where: { orgId: g.orgId }, orderBy: { createdAt: "desc" } }).catch(() => []),
    db.ontoWebhook.findMany({ where: { organizationId: g.orgId }, orderBy: { actionKey: "asc" } }).catch(() => []),
  ]);
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <p className="text-sm">
        <Link href="/ontology" className="underline">
          Studio
        </Link>{" "}
        / Ops
      </p>
      <h1 className="text-xl font-bold ds-text">Policies, playbooks & alerts</h1>
      <p className="text-sm ds-text-2">
        The rules behind the scenes: who may see what, what runs on a schedule, what pages whom, and which
        outside systems sign off before a write commits.
      </p>
      <OpsBoards
        initialPolicies={policies.map((p) => ({ id: p.id, typeKey: p.typeKey, effect: p.effect, field: p.field, op: p.op, priority: p.priority, active: p.active }))}
        initialPlaybooks={playbooks.map((p) => ({
          id: p.id,
          name: p.name,
          schedule: p.schedule,
          enabled: p.enabled,
          lastRun: p.runs[0] ? { status: p.runs[0].status, at: p.runs[0].createdAt.toISOString().slice(0, 16).replace("T", " ") } : null,
        }))}
        initialAlerts={alerts.map((r) => ({ id: r.id, pack: r.pack, metric: r.metric, op: r.op, threshold: r.threshold, channel: r.channel, owner: r.owner, responseAction: r.responseAction, windowMinutes: r.windowMinutes, active: r.active }))}
        initialWebhooks={webhooks.map((h) => ({ id: h.id, actionKey: h.actionKey, url: h.url, active: h.active, lastStatus: h.lastStatus, lastAt: h.lastAt?.toISOString() ?? null }))}
        verbs={MANUFACTURING_ACTIONS.map((a) => a.key)}
      />
    </main>
  );
}
