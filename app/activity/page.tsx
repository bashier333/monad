import Link from "next/link";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";

export default async function ActivityPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>
          <Link href="/signin" className="underline">
            Sign in
          </Link>{" "}
          to see activity.
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
  const events = await db.accessLog.findMany({
    where: { organizationId: active.organization.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <main className="mx-auto max-w-4xl space-y-3 p-4 md:p-8">
      <h1 className="text-xl font-bold">Activity — who changed what</h1>
      {events.length === 0 ? (
        <p className="text-sm text-gray-600">No activity yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm" aria-label="Organization activity">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1" scope="col">When</th>
                <th scope="col">Action</th>
                <th scope="col">Target</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="py-1">{new Date(e.createdAt).toLocaleString()}</td>
                  <td className="font-mono">{e.action}</td>
                  <td className="max-w-xs truncate">{e.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
