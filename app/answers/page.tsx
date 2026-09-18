import Link from "next/link";
import NlBox from "@/components/NlBox";
import ShareButton from "@/components/ShareButton";
import WeekPicker from "@/components/WeekPicker";
import { getWeeklyAnswer, resolveWeek } from "@/lib/answers/service";
import { auth } from "@/lib/auth";
import { getActiveOrg } from "@/lib/org";

const TOPIC_LABEL: Record<string, string> = {
  losers: "Losers first",
  winners: "Winners first",
  detention: "Detention spotlight",
  fees: "Fees spotlight",
  fuel: "Fuel spotlight",
};

export default async function AnswersPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; topic?: string }>;
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

  const answer = await getWeeklyAnswer(active.organization.id, active.organization.weekStartsOn, anchor);
  let lanes = answer.lanes;
  if (sp.topic === "losers") lanes = [...lanes].sort((a, b) => a.margin - b.margin);
  if (sp.topic === "winners") lanes = [...lanes].sort((a, b) => b.margin - a.margin);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Lane margins</h1>
        <WeekPicker current={answer.meta.weekStart} />
      </div>
      <p className="text-sm text-gray-600">
        <Link href="/help" className="underline">How to read this</Link>
      </p>
      <NlBox week={answer.meta.weekStart} />
      {sp.topic && TOPIC_LABEL[sp.topic] && (
        <p className="text-sm text-gray-600">{TOPIC_LABEL[sp.topic]}</p>
      )}

      {lanes.length === 0 ? (
        <div className="rounded border p-6 text-center">
          <p className="font-medium">No loads this week.</p>
          <p className="mt-1 text-sm text-gray-600">
            <Link href="/upload" className="underline">
              Upload an export
            </Link>{" "}
            to get your first answer — most teams see one in under a day.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            <div className="rounded border p-2">Revenue: ${answer.totals.revenue.toFixed(2)}</div>
            <div className="rounded border p-2">Cost: ${answer.totals.cost.toFixed(2)}</div>
            <div className="rounded border p-2">Margin: ${answer.totals.margin.toFixed(2)}</div>
            <div className="rounded border p-2">
              {answer.totals.marginPct === null ? "—" : `${answer.totals.marginPct}%`} · {answer.totals.loads} loads ·{" "}
              {answer.meta.currency} · {answer.meta.distanceUnit}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-1">Lane</th>
                  <th className="text-right">Loads</th>
                  <th className="text-right">Revenue</th>
                  <th className="text-right">Cost</th>
                  <th className="text-right">Margin</th>
                  <th className="text-right">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {lanes.map((l) => (
                  <tr key={l.lane} className="border-t">
                    <td className="py-1">
                      <Link
                        href={`/answers/lane?lane=${encodeURIComponent(l.lane)}&week=${answer.meta.weekStart}`}
                        className="underline"
                      >
                        {l.lane}
                      </Link>
                    </td>
                    <td className="text-right">{l.loads}</td>
                    <td className="text-right">${l.revenue.toFixed(2)}</td>
                    <td className="text-right">${l.cost.toFixed(2)}</td>
                    <td className={`text-right font-medium ${l.margin < 0 ? "text-red-600" : "text-green-700"}`}>
                      ${l.margin.toFixed(2)}
                    </td>
                    <td className="text-right">{l.marginPct === null ? "—" : `${l.marginPct}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
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
          <a href={`/api/answers/export?week=${answer.meta.weekStart}`} className="underline">
            Download CSV
          </a>
          <ShareButton week={answer.meta.weekStart} />
        </div>
      </section>
    </main>
  );
}
