import Link from "next/link";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";
import { verifyEventChain } from "@/lib/core/ontology/facts";
import AgentConsole from "@/app/ontology/automations/console";
import EvalsPanel from "@/app/ontology/automations/evals-panel";

async function gate() {
  const session = await auth();
  if (!session?.user?.id) return { gate: "signin" as const };
  const active = await getActiveOrg(session.user.id);
  if (!active) return { gate: "noorg" as const };
  return { gate: "ok" as const, orgId: active.organization.id };
}

export default async function AutomationsPage() {
  const g = await gate();
  if (g.gate !== "ok") {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>
          <Link href="/signin" className="underline">
            Sign in
          </Link>{" "}
          to open the automation console.
        </p>
      </main>
    );
  }
  const [approvals, runs, chain] = await Promise.all([
    db.ontoApproval
      .findMany({
        where: { organizationId: g.orgId, status: "pending", actionKey: { startsWith: "mfg_" } },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
      .catch(() => []),
    db.ontoActionRun
      .findMany({
        where: { organizationId: g.orgId, actionKey: { startsWith: "mfg_" } },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
      .catch(() => []),
    verifyEventChain(g.orgId, 5000).catch(() => ({ ok: false, checked: 0, brokenAt: null as string | null })),
  ]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <p className="text-sm">
        <Link href="/ontology" className="underline">
          Studio
        </Link>{" "}
        / Automations
      </p>
      <h1 className="text-xl font-bold ds-text">Automation console</h1>
      <p className="text-sm ds-text-2">
        Ask questions in plain English. The model reads your live data, shows its work step by step, and
        only ever proposes — you decide what runs.
      </p>

      <AgentConsole />

      <EvalsPanel />

      <section>
        <h2 className="font-medium ds-text">Pending confirmations ({approvals.length})</h2>
        {approvals.length === 0 ? (
          <p className="mt-2 rounded border border-dashed p-4 text-sm ds-text-2" style={{ borderColor: "var(--hairline)" }}>Nothing awaiting confirmation.</p>
        ) : (
          <ul className="mt-2 divide-y rounded ds-panel" style={{ borderColor: "var(--hairline)" }}>
            {approvals.map((a) => (
              <li key={a.id} className="p-3 text-sm">
                <span className="font-medium ds-text">{a.actionKey}</span> <span className="ds-text-2">on {a.objectId}</span>{" "}
                <span className="ds-text-2">
                  needs {a.requiredCount} — requested {a.createdAt.toISOString().slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-medium ds-text">Action lineage ({runs.length})</h2>
        {runs.length === 0 ? (
          <p className="mt-2 rounded border border-dashed p-4 text-sm ds-text-2" style={{ borderColor: "var(--hairline)" }}>No manufacturing action runs yet.</p>
        ) : (
          <ul className="mt-2 divide-y rounded ds-panel" style={{ borderColor: "var(--hairline)" }}>
            {runs.map((r) => (
              <li key={r.id} className="p-3 text-sm">
                <span className="font-medium ds-text">{r.actionKey}</span> <span className="ds-text-2">on {r.objectId}</span>{" "}
                <span className="ds-text-2">
                  {r.status} — {r.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-medium ds-text">Audit chain</h2>
        <p className="mt-2 rounded p-4 text-sm ds-panel">
          {chain.ok ? (
            <span style={{ color: "var(--success)" }}>Verified: {chain.checked} events, no breaks.</span>
          ) : (
            <span style={{ color: "var(--danger)" }}>
              Broken at {chain.brokenAt} ({chain.checked} events checked).
            </span>
          )}
        </p>
      </section>
    </main>
  );
}
