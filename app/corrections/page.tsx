import Link from "next/link";
import DecideButtons from "@/components/DecideButtons";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";

export default async function CorrectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>
          <Link href="/api/auth/signin" className="underline">
            Sign in
          </Link>{" "}
          to review corrections.
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

  const status = sp.status ?? "open";
  const corrections = await db.correction.findMany({
    where: { organizationId: active.organization.id, ...(status === "all" ? {} : { status }) },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const canDecide = active.membership.role === "OWNER";

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4 md:p-8">
      <h1 className="text-xl font-bold">Correction queue</h1>
      <div className="flex gap-3 text-sm">
        {["open", "applied", "rejected", "reverted", "all"].map((s) => (
          <Link key={s} href={`/corrections?status=${s}`} className={`underline ${status === s ? "font-bold" : ""}`}>
            {s}
          </Link>
        ))}
      </div>
      {corrections.length === 0 ? (
        <p className="text-sm text-gray-600">Nothing here. Flag a figure from any lane to start the trail.</p>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-1">Load</th>
              <th>Field</th>
              <th>→ New</th>
              <th>Reason</th>
                <th>Status</th>
                {canDecide && <th>Decide</th>}
            </tr>
          </thead>
          <tbody>
            {corrections.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="py-1 font-mono">{c.targetKey}</td>
                <td>{c.field}</td>
                <td>{c.newValue || "—"}</td>
                <td className="max-w-xs truncate">{c.reason}</td>
                <td>{c.status}</td>
                {canDecide && (
                  <td>
                    <DecideButtons id={c.id} status={c.status} />{" "}
                    <Link
                      href={`/rules?fromCorrection=${c.id}&matchValue=${encodeURIComponent(c.targetKey)}&toLoad=${encodeURIComponent(c.newValue || "EXCLUDE")}&reason=${encodeURIComponent(c.reason)}`}
                      className="text-xs underline"
                    >
                      make rule
                    </Link>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
      {!canDecide && <p className="text-xs text-gray-500">Only owners can apply or reject corrections.</p>}
    </main>
  );
}
