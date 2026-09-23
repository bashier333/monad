import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";
import ActionRunner from "@/app/ontology/actions/runner";

export default async function ActionsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <Link href="/signin" className="underline">
          Sign in
        </Link>
      </main>
    );
  }
  const active = await getActiveOrg(session.user.id);
  if (!active) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>No organization yet.</p>
      </main>
    );
  }
  const [actions, approvals] = await Promise.all([
    db.ontoAction.findMany({ where: { organizationId: active.organization.id, enabled: true }, orderBy: { key: "asc" } }),
    db.ontoApproval.findMany({
      where: { organizationId: active.organization.id, status: "pending" },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <p className="text-sm">
        <Link href="/ontology" className="underline">
          Studio
        </Link>{" "}
        / Actions
      </p>
      <h1 className="text-xl font-bold ds-text">Actions console</h1>
      <p className="text-sm ds-text-2">
        Every change this system can make, in one place. Pick an action and a target, preview the exact
        before-and-after, then run it — approvals included.
      </p>
      <Suspense fallback={<p className="text-sm ds-text-2">Loading runner…</p>}>
        <ActionRunner
          actions={actions.map((a) => ({
            key: a.key,
            label: a.label,
            targetTypeKey: a.targetTypeKey,
            approvalPolicy: a.approvalPolicy,
            requiredCount: a.requiredCount,
            inputs: (a.inputs as Record<string, unknown>) ?? {},
          }))}
        />
      </Suspense>
      <section>
        <h2 className="font-medium ds-text">Pending approvals ({approvals.length})</h2>
        {approvals.length === 0 ? (
          <p className="mt-2 rounded border border-dashed p-4 text-sm ds-text-2" style={{ borderColor: "var(--hairline)" }}>Inbox empty.</p>
        ) : (
          <ul className="mt-2 divide-y rounded ds-panel" style={{ borderColor: "var(--hairline)" }}>
            {approvals.map((a) => (
              <li key={a.id} className="p-3 text-sm">
                <span className="font-medium ds-text">{a.actionKey}</span> <span className="ds-text-2">on {a.objectId}</span>{" "}
                <span className="ds-text-2">
                  needs {a.requiredCount} · requested {a.createdAt.toISOString().slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
