import Link from "next/link";
import BriefCopyButtons from "@/components/BriefCopyButtons";
import BriefFeedback from "@/components/BriefFeedback";
import GenerateBriefButton from "@/components/GenerateBriefButton";
import PrintButton from "@/components/PrintButton";
import type { BriefContent } from "@/lib/core/brief/content";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";

export default async function BriefPage({
  params,
  searchParams,
}: {
  params: Promise<{ week: string }>;
  searchParams: Promise<{ pack?: string; mode?: string }>;
}) {
  const { week } = await params;
  const sp = await searchParams;
  const pack = sp.pack === "agency" ? "agency" : "freight";
  const mode = sp.mode === "monday" || sp.mode === "tv" ? sp.mode : null;
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
    where: { organizationId_weekStart_pack: { organizationId: active.organization.id, weekStart: week, pack } },
  });
  if (!brief) {
    return (
      <main className="mx-auto max-w-2xl space-y-3 p-8">
        <p className="ds-text">No brief for week of {week} yet.</p>
        <GenerateBriefButton pack={pack} />
        <p>
          <Link href="/briefs" className="underline ds-text-2">
            ← All briefs
          </Link>
        </p>
      </main>
    );
  }

  const c = brief.content as unknown as BriefContent;
  const laneHref = (lane: string) =>
    pack === "agency"
      ? `/answers/project?project=${encodeURIComponent(lane)}&week=${c.weekStart}`
      : `/answers/lane?lane=${encodeURIComponent(lane)}&week=${c.weekStart}`;
  const worst = [...(c.losers ?? [])].sort((a, b) => a.margin - b.margin)[0];
  const tldr = [
    `Margin $${c.totals.margin.toFixed(2)} on $${c.totals.revenue.toFixed(2)} revenue.`,
    worst ? `Worst: ${worst.lane} at $${worst.margin.toFixed(2)}.` : "No losing lanes this week.",
    c.anomalies.length > 0
      ? `${c.anomalies.length} lane${c.anomalies.length === 1 ? "" : "s"} moved more than expected.`
      : "Nothing moved more than expected.",
  ];

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 md:p-8">
      {mode === "tv" && <meta httpEquiv="refresh" content="300" />}
      <p className="print:hidden text-sm ds-text-2">
        <Link href="/briefs" className="underline">
          ← All briefs
        </Link>
        {" · "}
        <Link href={`/briefs/${week}?pack=${pack}&mode=monday`} className="underline">
          Monday mode
        </Link>
        {" · "}
        <Link href={`/briefs/${week}?pack=${pack}&mode=tv`} className="underline">
          TV mode
        </Link>
        {mode === "tv" && <span> · refreshes every 5 min</span>}
      </p>
      <h1 className={`${mode === "monday" ? "text-4xl" : "text-xl"} font-bold ds-text`}>
        Week of {c.weekStart} {pack === "agency" ? "(studio)" : "(fleet)"}
      </h1>

      <section aria-label="TL;DR" className="rounded border p-4 ds-panel" style={{ borderColor: "var(--hairline)" }}>
        <h2 className="font-medium ds-text">TL;DR</h2>
        <ul className="mt-1 list-disc pl-5 text-sm ds-text">
          {tldr.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </section>

      <p className={`rounded border p-4 ds-panel ds-text ${mode === "monday" ? "text-2xl" : ""}`} style={{ borderColor: "var(--hairline)" }}>{c.paragraph}</p>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="rounded border p-2 ds-panel ds-text" style={{ borderColor: "var(--hairline)" }}>Revenue: ${c.totals.revenue.toFixed(2)}</div>
        <div className="rounded border p-2 ds-panel ds-text" style={{ borderColor: "var(--hairline)" }}>Cost: ${c.totals.cost.toFixed(2)}</div>
        <div className="rounded border p-2 ds-panel ds-text" style={{ borderColor: "var(--hairline)" }}>Margin: ${c.totals.margin.toFixed(2)}</div>
      </div>

      {c.anomalies.length > 0 && (
        <section className="rounded border p-4 text-sm ds-panel" style={{ borderColor: "var(--hairline)" }}>
          <h2 className="font-medium ds-text">Moved more than expected</h2>
          <ul className="mt-1 list-disc pl-5 ds-text-2">
            {c.anomalies.map((a) => (
              <li key={a.lane}>
                <Link href={laneHref(a.lane)} className="underline ds-text">{a.lane}</Link>: {a.direction}{" "}
                {Math.abs(a.swingPts)}pts ({a.causes.join(", ")})
              </li>
            ))}
          </ul>
        </section>
      )}

      {((c.newSince?.lanes.length ?? 0) + (c.newSince?.trucks.length ?? 0) + (c.newSince?.brokers.length ?? 0)) > 0 && (
        <section className="rounded border p-4 text-sm ds-panel" style={{ borderColor: "var(--hairline)" }}>
          <h2 className="font-medium ds-text">New since last week</h2>
          <ul className="mt-1 list-disc pl-5 ds-text-2">
            {(c.newSince?.lanes ?? []).map((l) => (
              <li key={l}>
                {pack === "agency" ? "Project" : "Lane"}:{" "}
                <Link href={laneHref(l)} className="underline ds-text">{l}</Link>
              </li>
            ))}
            {(c.newSince?.trucks ?? []).map((t) => (
              <li key={t}>{pack === "agency" ? "Team member" : "Truck"}: {t}</li>
            ))}
            {(c.newSince?.brokers ?? []).map((b) => (
              <li key={b}>{pack === "agency" ? "Client" : "Broker"}: {b}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-2 text-sm md:grid-cols-2">
        <div className="rounded border p-3 ds-panel" style={{ borderColor: "var(--hairline)" }}>
          <h2 className="font-medium ds-text">Winners</h2>
          <ul className="mt-1 ds-text-2">
            {c.winners.map((w) => (
              <li key={w.lane}>
                <Link href={laneHref(w.lane)} className="underline ds-text">{w.lane}</Link>: ${w.margin.toFixed(2)}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded border p-3 ds-panel" style={{ borderColor: "var(--hairline)" }}>
          <h2 className="font-medium ds-text">Losers</h2>
          <ul className="mt-1 ds-text-2">
            {c.losers.map((l) => (
              <li key={l.lane}>
                <Link href={laneHref(l.lane)} className="underline ds-text">{l.lane}</Link>: ${l.margin.toFixed(2)}
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
        <BriefCopyButtons summary={tldr.join(" ")} />
        <Link
          href={pack === "agency" ? `/answers/projects?week=${c.weekStart}` : `/answers?week=${c.weekStart}`}
          className="text-sm underline ds-text"
        >
          Open the full answer
        </Link>
      </div>
    </main>
  );
}
