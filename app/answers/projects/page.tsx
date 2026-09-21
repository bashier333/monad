import Link from "next/link";
import NlBox from "@/components/NlBox";
import PackSwitchLink from "@/components/PackSwitchLink";
import ShareButton from "@/components/ShareButton";
import WeekPicker from "@/components/WeekPicker";
import { getAgencyAnswer } from "@/lib/packs/agency/service";
import { resolveWeek } from "@/lib/core/answers/service";
import { auth } from "@/lib/core/auth";
import { getActiveOrg } from "@/lib/core/org";

const TOPIC_LABEL: Record<string, string> = {
  losers: "Losers first",
  winners: "Winners first",
  rework: "Rework spotlight",
  approvals: "Approvals spotlight",
  bottlenecks: "Bottlenecks spotlight",
};

export default async function AgencyAnswersPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; topic?: string; pack?: string }>;
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
          to see answers.
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

  let anchor: string;
  try {
    anchor = resolveWeek(sp.week ?? null);
  } catch {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>Bad week parameter. Use YYYY-MM-DD.</p>
      </main>
    );
  }

  const settings = (active.organization.settings ?? {}) as { agencyWeekStartsOn?: number };
  const weekStartsOn = settings.agencyWeekStartsOn ?? active.organization.weekStartsOn;
  const answer = await getAgencyAnswer(active.organization.id, weekStartsOn, anchor);
  let projects = answer.projects;
  if (sp.topic === "losers" || !sp.topic) projects = [...projects].sort((a, b) => a.margin - b.margin);
  if (sp.topic === "winners") projects = [...projects].sort((a, b) => b.margin - a.margin);
  if (sp.topic === "rework") projects = [...projects].sort((a, b) => b.cost - a.cost);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Project margins</h1>
        <WeekPicker current={answer.meta.weekStart} />
      </div>
      <p className="text-sm text-gray-600">
        <Link href="/help#agency" className="underline">How to read this</Link> ·{" "}
        <PackSwitchLink href="/answers" label="Fleet answers →" />
      </p>
      <NlBox week={answer.meta.weekStart} pack="agency" />
      {sp.topic && TOPIC_LABEL[sp.topic] && (
        <p className="text-sm text-gray-600">{TOPIC_LABEL[sp.topic]}</p>
      )}

      {projects.length === 0 ? (
        <div className="rounded border p-6 text-center">
          <p className="font-medium">No projects this week.</p>
          <p className="mt-1 text-sm text-gray-600">
            <Link href="/upload" className="underline">
              Upload an export
            </Link>{" "}
            or load the studio sample week from{" "}
            <Link href="/upload" className="underline">
              Upload
            </Link>{" "}
            — most teams see their first answer in under a day.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            <div className="rounded border p-2">Revenue: ${answer.totals.revenue.toFixed(2)}</div>
            <div className="rounded border p-2">Cost: ${answer.totals.cost.toFixed(2)}</div>
            <div className="rounded border p-2">Margin: ${answer.totals.margin.toFixed(2)}</div>
            <div className="rounded border p-2">
              {answer.totals.marginPct === null ? "—" : `${answer.totals.marginPct}%`} · {answer.totals.revisions} revisions ·{" "}
              {answer.meta.currency}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm" aria-label="Project margins, worst first">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-1">Project</th>
                  <th>Client</th>
                  <th className="text-right">Rounds</th>
                  <th className="text-right">Revenue</th>
                  <th className="text-right">Cost</th>
                  <th className="text-right">Margin</th>
                  <th className="text-right">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.project} className="border-t">
                    <td className="py-1">
                      <Link
                        href={`/answers/project?project=${encodeURIComponent(p.project)}&week=${answer.meta.weekStart}`}
                        className="underline"
                      >
                        {p.project}
                      </Link>
                    </td>
                    <td>{p.client || "—"}</td>
                    <td className="text-right">{p.revisions}</td>
                    <td className="text-right">${p.revenue.toFixed(2)}</td>
                    <td className="text-right">${p.cost.toFixed(2)}</td>
                    <td className={`text-right font-medium ${p.margin < 0 ? "text-red-600" : "text-green-700"}`}>
                      ${p.margin.toFixed(2)}
                    </td>
                    <td className="text-right">{p.marginPct === null ? "—" : `${p.marginPct}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {answer.unmatchedRevenue.length > 0 && (
        <section className="rounded border p-4 text-sm">
          <h2 className="font-medium">Invoices without projects ({answer.unmatchedRevenue.length})</h2>
          <ul className="mt-1 list-disc pl-5 text-gray-700">
            {answer.unmatchedRevenue.map((u) => (
              <li key={u.project}>
                {u.project} — ${u.amount.toFixed(2)} (usually a client-name variant; add an alias)
              </li>
            ))}
          </ul>
        </section>
      )}

      {answer.joinConflicts.length > 0 && (
        <section className="rounded border p-4 text-sm">
          <h2 className="font-medium">Conflicting hours ({answer.joinConflicts.length})</h2>
          <ul className="mt-1 list-disc pl-5 text-gray-700">
            {answer.joinConflicts.slice(0, 20).map((c, i) => (
              <li key={i}>
                {c.project} · {c.person} · {c.date} — {c.hoursA}h vs {c.hoursB}h (kept both, nothing overwritten)
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded border p-4 text-sm">
        <h2 className="font-medium">How this answer was built</h2>
        <ul className="mt-1 list-disc pl-5 text-gray-700">
          {answer.appliedRules.map((r) => (
            <li key={r.id}>
              <span className="font-mono">{r.id}</span> — {r.sentence}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-gray-500">
          Week {answer.meta.weekStart} → {answer.meta.weekEnd} · data as of{" "}
          {answer.meta.dataAsOf ? new Date(answer.meta.dataAsOf).toLocaleString() : "—"} · engine{" "}
          {answer.meta.engineVersion}
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <a href={`/api/answers/export?pack=agency&week=${answer.meta.weekStart}`} className="underline">
            Download CSV
          </a>
          <ShareButton week={answer.meta.weekStart} pack="agency" />
        </div>
      </section>
    </main>
  );
}
