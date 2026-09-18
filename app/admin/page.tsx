import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveOrg } from "@/lib/org";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>
          <Link href="/api/auth/signin" className="underline">
            Sign in
          </Link>{" "}
          for admin.
        </p>
      </main>
    );
  }
  const active = await getActiveOrg(session.user.id);
  if (!active || active.membership.role !== "OWNER") {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>Owners only.</p>
      </main>
    );
  }

  const orgId = active.organization.id;
  const [users, uploads, answers, corrections, briefs, subs] = await Promise.all([
    db.user.count(),
    db.meterEvent.aggregate({ where: { organizationId: orgId, kind: "upload" }, _sum: { qty: true } }),
    db.meterEvent.aggregate({ where: { organizationId: orgId, kind: "answer_view" }, _sum: { qty: true } }),
    db.correction.groupBy({ by: ["status"], where: { organizationId: orgId }, _count: true }),
    db.brief.findMany({ where: { organizationId: orgId }, select: { weekStart: true, feedback: true }, take: 12 }),
    db.subscription.findUnique({ where: { organizationId: orgId } }),
  ]);

  const votes = briefs.flatMap((b) =>
    ((b.feedback ?? []) as Array<{ up?: boolean; note?: string; at?: string }>).map((f) => ({ ...f, week: b.weekStart })),
  );
  const ups = votes.filter((v) => v.up !== false).length;
  const quality = votes.length === 0 ? null : Math.round((ups / votes.length) * 100);
  const corrTotal = corrections.reduce((s, c) => s + c._count, 0);
  const pilots = await db.pilotChecklist.findMany({
    select: { organizationId: true, firstAnswerAt: true, firstCorrectionAt: true, meetingConfirmedAt: true, convertedAt: true },
    take: 50,
  });

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4 md:p-8">
      <h1 className="text-xl font-bold">Admin — {active.organization.name}</h1>
      <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
        <div className="rounded border p-2">Users (all orgs): {users}</div>
        <div className="rounded border p-2">Uploads: {uploads._sum.qty ?? 0}</div>
        <div className="rounded border p-2">Answers viewed: {answers._sum.qty ?? 0}</div>
        <div className="rounded border p-2">Corrections: {corrTotal}</div>
        <div className="rounded border p-2">Briefs: {briefs.length}</div>
        <div className="rounded border p-2">Brief quality: {quality === null ? "no votes yet" : `${quality}% up (${votes.length} votes)`}</div>
        <div className="rounded border p-2">
          Plan: {subs?.tier ?? "free"} ({subs?.status ?? "active"})
        </div>
      </div>
      {votes.filter((v) => v.up === false).length > 0 && (
        <section className="rounded border p-3 text-sm">
          <h2 className="font-medium">Thumbs-down feedback</h2>
          <ul className="mt-1 list-disc pl-5">
            {votes.filter((v) => v.up === false).slice(0, 10).map((v, i) => (
              <li key={i}>
                {v.week}: {v.note || "(no note)"}
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/api/admin/failures" className="underline">
          Failures JSON
        </Link>
        <Link href="/api/admin/costs" className="underline">
          Costs JSON
        </Link>
        <Link href="/api/billing/usage" className="underline">
          Usage JSON
        </Link>
        <Link href="/corrections" className="underline">
          Correction queue
        </Link>
      </div>
      <p className="text-xs text-gray-500">
        Reviewed every Monday. Charts graduate to a real dashboard after 3 pilots.
      </p>
      {pilots.length > 0 && (
        <section className="rounded border p-3 text-sm">
          <h2 className="font-medium">Cross-pilot comparison</h2>
          <table className="mt-1 w-full">
            <thead>
              <tr className="text-left text-gray-500">
                <th>Org</th>
                <th>Answer</th>
                <th>Meeting</th>
                <th>Correction</th>
                <th>Converted</th>
              </tr>
            </thead>
            <tbody>
              {pilots.map((p) => (
                <tr key={p.organizationId} className="border-t">
                  <td className="font-mono">{p.organizationId.slice(0, 8)}</td>
                  <td>{p.firstAnswerAt ? "✓" : "○"}</td>
                  <td>{p.meetingConfirmedAt ? "✓" : "○"}</td>
                  <td>{p.firstCorrectionAt ? "✓" : "○"}</td>
                  <td>{p.convertedAt ? "✓" : "○"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
