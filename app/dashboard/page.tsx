import Link from "next/link";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>
          <Link href="/api/auth/signin" className="underline">
            Sign in
          </Link>{" "}
          to see your dashboard.
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
  const role = active.membership.role;
  const orgId = active.organization.id;
  const [runs, openCorrections, briefs, notifications] = await Promise.all([
    db.importRun.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, take: 3, include: { file: { select: { filename: true } } } }),
    db.correction.count({ where: { organizationId: orgId, status: "open" } }),
    db.brief.findMany({ where: { organizationId: orgId }, orderBy: { weekStart: "desc" }, take: 2, select: { weekStart: true, pack: true } }),
    db.notification.findMany({ where: { organizationId: orgId, userId: session.user.id, readAt: null }, take: 5, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4 md:p-8">
      <h1 className="text-xl font-bold">Home — {active.organization.name}</h1>
      {role === "OWNER" && (
        <section className="rounded border p-4 text-sm">
          <h2 className="font-medium">Owner overview</h2>
          <p className="mt-1">Open flags: {openCorrections} · <Link href="/corrections" className="underline">Review queue</Link></p>
          <p className="mt-1"><Link href="/admin" className="underline">Admin</Link> · <Link href="/settings" className="underline">Settings + billing</Link></p>
        </section>
      )}
      {role === "DISPATCHER" && (
        <section className="rounded border p-4 text-sm">
          <h2 className="font-medium">Today</h2>
          <p className="mt-1"><Link href="/upload" className="underline">Upload an export</Link> · <Link href="/corrections" className="underline">Flags ({openCorrections} open)</Link></p>
        </section>
      )}
      {role === "VIEWER" && (
        <section className="rounded border p-4 text-sm">
          <h2 className="font-medium">Answers</h2>
          <p className="mt-1"><Link href="/answers" className="underline">Fleet margins</Link> · <Link href="/answers/projects" className="underline">Studio margins</Link></p>
        </section>
      )}
      {notifications.length > 0 && (
        <section className="rounded border p-4 text-sm">
          <h2 className="font-medium">Unread ({notifications.length})</h2>
          <ul className="mt-1 list-disc pl-5">
            {notifications.map((n) => (
              <li key={n.id}><Link href={n.href || "/corrections"} className="underline">{n.title}</Link></li>
            ))}
          </ul>
        </section>
      )}
      <section className="rounded border p-4 text-sm">
        <h2 className="font-medium">Recent imports</h2>
        <ul className="mt-1 list-disc pl-5">
          {runs.map((r) => (
            <li key={r.id}><Link href={`/imports/${r.id}`} className="underline">{r.file.filename}</Link> ({r.status})</li>
          ))}
          {runs.length === 0 && <li>None yet — <Link href="/upload" className="underline">upload</Link> or try a sample.</li>}
        </ul>
      </section>
      <section className="rounded border p-4 text-sm">
        <h2 className="font-medium">Recent briefs</h2>
        <ul className="mt-1 list-disc pl-5">
          {briefs.map((b) => (
            <li key={`${b.weekStart}-${b.pack}`}><Link href={`/briefs/${b.weekStart}?pack=${b.pack}`} className="underline">Week of {b.weekStart} ({b.pack})</Link></li>
          ))}
          {briefs.length === 0 && <li>None yet.</li>}
        </ul>
      </section>
    </main>
  );
}
