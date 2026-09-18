import Link from "next/link";
import BriefFeedback from "@/components/BriefFeedback";
import PrintButton from "@/components/PrintButton";
import type { BriefContent } from "@/lib/brief/build";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveOrg } from "@/lib/org";

export default async function BriefPage({ params }: { params: Promise<{ week: string }> }) {
  const { week } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>
          <Link href="/api/auth/signin" className="underline">
            Sign in
          </Link>{" "}
          to see briefs.
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

  const brief = await db.brief.findUnique({
    where: { organizationId_weekStart: { organizationId: active.organization.id, weekStart: week } },
  });
  if (!brief) {
    return (
      <main className="mx-auto max-w-2xl space-y-3 p-8">
        <p>No brief for week of {week} yet.</p>
        <p>
          <Link href="/briefs" className="underline">
            ← All briefs
          </Link>
        </p>
      </main>
    );
  }

  const c = brief.content as unknown as BriefContent;

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 md:p-8">
      <p className="print:hidden text-sm">
        <Link href="/briefs" className="underline">
          ← All briefs
        </Link>
      </p>
      <h1 className="text-xl font-bold">Week of {c.weekStart}</h1>
      <p className="rounded border p-4">{c.paragraph}</p>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="rounded border p-2">Revenue: ${c.totals.revenue.toFixed(2)}</div>
        <div className="rounded border p-2">Cost: ${c.totals.cost.toFixed(2)}</div>
        <div className="rounded border p-2">Margin: ${c.totals.margin.toFixed(2)}</div>
      </div>

      {c.anomalies.length > 0 && (
        <section className="rounded border p-4 text-sm">
          <h2 className="font-medium">Moved more than expected</h2>
          <ul className="mt-1 list-disc pl-5">
            {c.anomalies.map((a) => (
              <li key={a.lane}>
                {a.lane}: {a.direction} {Math.abs(a.swingPts)}pts ({a.causes.join(", ")})
              </li>
            ))}
          </ul>
        </section>
      )}

      {((c.newSince?.lanes.length ?? 0) + (c.newSince?.trucks.length ?? 0) + (c.newSince?.brokers.length ?? 0)) > 0 && (
        <section className="rounded border p-4 text-sm">
          <h2 className="font-medium">New since last week</h2>
          <ul className="mt-1 list-disc pl-5">
            {(c.newSince?.lanes ?? []).map((l) => (
              <li key={l}>Lane: {l}</li>
            ))}
            {(c.newSince?.trucks ?? []).map((t) => (
              <li key={t}>Truck: {t}</li>
            ))}
            {(c.newSince?.brokers ?? []).map((b) => (
              <li key={b}>Broker: {b}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-2 text-sm md:grid-cols-2">
        <div className="rounded border p-3">
          <h2 className="font-medium">Winners</h2>
          <ul className="mt-1">
            {c.winners.map((w) => (
              <li key={w.lane}>
                {w.lane}: ${w.margin.toFixed(2)}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded border p-3">
          <h2 className="font-medium">Losers</h2>
          <ul className="mt-1">
            {c.losers.map((l) => (
              <li key={l.lane}>
                {l.lane}: ${l.margin.toFixed(2)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {(c.recentDecisions ?? []).length > 0 && (
        <section className="rounded border p-4 text-sm">
          <h2 className="font-medium">Decided this week</h2>
          <ul className="mt-1 list-disc pl-5">
            {c.recentDecisions.map((d, i) => (
              <li key={i}>
                {d.load} {d.field} → {d.status}: {d.reason}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="print:hidden flex flex-wrap items-center gap-3">
        <BriefFeedback id={brief.id} week={c.weekStart} />
        <PrintButton />
        <Link href={`/answers?week=${c.weekStart}`} className="text-sm underline">
          Open the full answer
        </Link>
      </div>
    </main>
  );
}
