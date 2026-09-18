import Link from "next/link";
import { Suspense } from "react";
import AliasManager from "@/components/AliasManager";
import RuleForm from "@/components/RuleForm";
import RuleToggle from "@/components/RuleToggle";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";

export default async function RulesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>
          <Link href="/api/auth/signin" className="underline">
            Sign in
          </Link>{" "}
          to manage rules.
        </p>
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
  const isOwner = active.membership.role === "OWNER";

  const rules = await db.standingRule.findMany({
    where: { organizationId: active.organization.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const lineage = rules.filter((r) => r.sourceCorrectionId).length;

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4 md:p-8">
      <h1 className="text-xl font-bold">Standing rules</h1>
      <p className="text-sm text-gray-600">
        Rules re-apply your corrections to every future week automatically. Disabling a rule re-runs
        affected answers immediately.
      </p>
      {isOwner && (
        <Suspense>
          <RuleForm week={new Date().toISOString().slice(0, 10)} />
        </Suspense>
      )}
      <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="py-1">Rule</th>
            <th>Moves to</th>
            <th>Active</th>
            {isOwner && <th />}
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="py-1">
                {r.costKind} where {r.matchField} = “{r.matchValue}”{" "}
                <span className="text-gray-500">— {r.reason}</span>
                {r.sourceCorrectionId && <span className="text-gray-500"> (from correction {r.sourceCorrectionId.slice(0, 8)})</span>}
              </td>
              <td>{r.toLoad ?? "EXCLUDED"}</td>
              <td>{r.active ? "yes" : "no"}</td>
              {isOwner && (
                <td>
                  <RuleToggle id={r.id} active={r.active} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {rules.length === 0 && <p className="text-sm text-gray-600">No rules yet.</p>}
      {lineage > 0 && <p className="text-xs text-gray-500">{lineage} rules trace back to corrections.</p>}
      {!isOwner && <p className="text-xs text-gray-500">Only owners can manage rules.</p>}
      <AliasManager />
    </main>
  );
}
