import Link from "next/link";
import DecideButtons from "@/components/DecideButtons";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";
import ApprovalCard from "@/app/ontology/inbox/card";
import InboxRefresh from "@/app/ontology/inbox/refresh";

async function gate() {
  const session = await auth();
  if (!session?.user?.id) return { gate: "signin" as const };
  const active = await getActiveOrg(session.user.id);
  if (!active) return { gate: "noorg" as const };
  return { gate: "ok" as const, orgId: active.organization.id, role: active.membership.role };
}

// Unified approvals inbox: ontology action approvals (with comments) and
// open data corrections side by side. ?tab=approvals|corrections filters;
// the refresh control polls so cross-tab decisions don't sit stale.
export default async function InboxPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const show = tab === "corrections" ? "corrections" : tab === "approvals" ? "approvals" : "all";
  const g = await gate();
  if (g.gate !== "ok") {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>
          <Link href="/signin" className="underline">
            Sign in
          </Link>{" "}
          to open the inbox.
        </p>
      </main>
    );
  }
  const [approvals, corrections] = await Promise.all([
    db.ontoApproval.findMany({
      where: { organizationId: g.orgId, status: "pending" },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.correction.findMany({
      where: { organizationId: g.orgId, status: "open" },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <p className="text-sm">
        <Link href="/ontology" className="underline">
          Studio
        </Link>{" "}
        / Inbox
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold ds-text">Approvals inbox</h1>
          <p className="mt-1 text-sm ds-text-2">
            Everything waiting on a human: action approvals and data corrections side by side. Nothing here
            runs itself. Focus a card and press A / R to decide.
          </p>
        </div>
        <InboxRefresh />
      </div>
      {g.role !== "OWNER" && (
        <p className="rounded border p-3 text-sm ds-panel" style={{ borderColor: "var(--hairline)" }}>
          <span className="font-medium ds-text">Your role: {g.role}.</span>{" "}
          <span className="ds-text-2">Only owners can approve or reject — decisions will fail until an owner acts.</span>
        </p>
      )}
      <div className="flex gap-1 text-sm" role="group" aria-label="Filter inbox">
        {[
          { key: "all", label: `All (${approvals.length + corrections.length})` },
          { key: "approvals", label: `Approvals (${approvals.length})` },
          { key: "corrections", label: `Corrections (${corrections.length})` },
        ].map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/ontology/inbox" : `/ontology/inbox?tab=${t.key}`}
            aria-current={show === t.key ? "page" : undefined}
            className="rounded px-2 py-1 ds-state"
            style={show === t.key ? { background: "var(--accent)", color: "#ffffff", fontWeight: 500 } : { color: "var(--fg-2)" }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {(show === "all" || show === "approvals") && (
      <section>
        <h2 className="font-medium ds-text">Action approvals ({approvals.length})</h2>
        {approvals.length === 0 ? (
          <p className="mt-2 rounded border border-dashed p-4 text-sm ds-text-2" style={{ borderColor: "var(--hairline)" }}>No pending action approvals.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {approvals.map((a) => (
              <ApprovalCard
                key={a.id}
                approval={{
                  id: a.id,
                  actionKey: a.actionKey,
                  objectId: a.objectId,
                  inputs: (a.inputs ?? null) as Record<string, unknown> | null,
                  requestedById: a.requestedById,
                  approvals: a.approvals,
                  requiredCount: a.requiredCount,
                  createdAt: a.createdAt.toISOString(),
                }}
              />
            ))}
          </ul>
        )}
      </section>
      )}

      {(show === "all" || show === "corrections") && (
      <section>
        <h2 className="font-medium ds-text">Open corrections ({corrections.length})</h2>
        {corrections.length === 0 ? (
          <p className="mt-2 rounded border border-dashed p-4 text-sm ds-text-2" style={{ borderColor: "var(--hairline)" }}>No open corrections.</p>
        ) : (
          <ul className="mt-2 divide-y rounded ds-panel" style={{ borderColor: "var(--hairline)" }}>
            {corrections.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                <span>
                  <span className="font-medium ds-text">{c.targetKey}</span>{" "}
                  <span className="ds-text-2">
                    {c.field} {c.oldValue} → {c.newValue}
                  </span>
                </span>
                <DecideButtons id={c.id} status={c.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
      )}
    </main>
  );
}
