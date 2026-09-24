import Link from "next/link";
import { auth } from "@/lib/core/auth";
import { getActiveOrg } from "@/lib/core/org";

const MATRIX: Array<{ action: string; owner: boolean; dispatcher: boolean; viewer: boolean }> = [
  { action: "answer:view", owner: true, dispatcher: true, viewer: true },
  { action: "upload:import", owner: true, dispatcher: true, viewer: false },
  { action: "correction:propose", owner: true, dispatcher: true, viewer: false },
  { action: "correction:approve", owner: true, dispatcher: false, viewer: false },
  { action: "rule:manage", owner: true, dispatcher: false, viewer: false },
  { action: "org:invite", owner: true, dispatcher: false, viewer: false },
  { action: "billing:manage", owner: true, dispatcher: false, viewer: false },
];

export default async function RolesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>
          <Link href="/signin" className="underline">
            Sign in
          </Link>{" "}
          to see permissions.
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
  return (
    <main className="mx-auto max-w-3xl space-y-3 p-4 md:p-8">
      <h1 className="text-xl font-bold">Who can do what (mirrors lib/core/roles.ts)</h1>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm" aria-label="Permission matrix">
          <thead>
            <tr className="text-left ds-text-2">
              <th className="py-1" scope="col">Capability</th>
              <th scope="col">Owner</th>
              <th scope="col">Dispatcher</th>
              <th scope="col">Viewer</th>
            </tr>
          </thead>
          <tbody>
            {MATRIX.map((r) => (
              <tr key={r.action} className="border-t">
                <td className="py-1 font-mono">{r.action}</td>
                <td>{r.owner ? "✓" : "—"}</td>
                <td>{r.dispatcher ? "✓" : "—"}</td>
                <td>{r.viewer ? "✓" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
