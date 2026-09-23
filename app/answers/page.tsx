import Link from "next/link";
import NlBox from "@/components/NlBox";
import ShareButton from "@/components/ShareButton";
import UpgradeCta from "@/components/UpgradeCta";
import WeekPicker from "@/components/WeekPicker";
import { DataTable, ProofStrip } from "@/components/primitives";
import { getWeeklyAnswer } from "@/lib/packs/freight/service"; import { resolveWeek } from "@/lib/core/answers/service";
import { auth } from "@/lib/core/auth";
import { recordUsage } from "@/lib/core/billing";
import { getActiveOrg } from "@/lib/core/org";
import { historyBlocked } from "@/lib/core/guards";
import { stampFirstAnswer } from "@/lib/core/pilots";

const TOPICS = [
  ["losers", "Losers first"],
  ["winners", "Winners first"],
  ["detention", "Detention spotlight"],
  ["fees", "Fees spotlight"],
  ["fuel", "Fuel spotlight"],
] as const;

function shiftWeek(week: string, weeks: number): string {
  const d = new Date(`${week}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

function Delta({ label, value, format }: { label: string; value: number | null; format: (v: number) => string }) {
  if (value === null || !Number.isFinite(value)) {
    return (
      <span className="ds-text-2">
        {label}: —
      </span>
    );
  }
  const up = value > 0;
  const flat = value === 0;
  return (
    <span
      className="ds-text-2"
      aria-label={`${label}: ${format(value)} ${flat ? "(flat)" : up ? "(up)" : "(down)"} vs last week`}
      style={flat ? undefined : { color: up ? "var(--success)" : "var(--danger)" }}
    >
      <span aria-hidden>{flat ? "■ " : up ? "▲ " : "▼ "}</span>
      {label}: {up ? "+" : ""}{format(value)}
    </span>
  );
}

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
          <Link href="/signin" className="underline">
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

  // Same paywall as the API: free tier sees 90 days, older weeks unlock.
  if (await historyBlocked(active.organization.id, anchor)) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-4 md:p-8">
        <h1 className="text-xl font-bold ds-text">Lane margins</h1>
        <WeekPicker current={anchor} />
        <div className="rounded border p-6 text-center ds-panel" style={{ borderColor: "var(--hairline)" }}>
          <p className="font-medium ds-text">Week of {anchor} is outside your free 90-day history.</p>
          <p className="mt-1 text-sm ds-text-2">Team keeps full history — every week you have ever run.</p>
          <p className="mt-3">
            <UpgradeCta from="answers_history" label="Unlock full history" />
          </p>
        </div>
      </main>
    );
  }

  const answer = await getWeeklyAnswer(active.organization.id, active.organization.weekStartsOn, anchor);
  const prev = await getWeeklyAnswer(active.organization.id, active.organization.weekStartsOn, shiftWeek(anchor, -1)).catch(() => null);
  // Page views are answers viewed: meter + first-answer stamp like the API.
  await recordUsage(active.organization.id, "answer_view").catch(() => undefined);
  await stampFirstAnswer(active.organization.id).catch(() => undefined);

  let lanes = answer.lanes;
  if (sp.topic === "losers") lanes = [...lanes].sort((a, b) => a.margin - b.margin);
  if (sp.topic === "winners") lanes = [...lanes].sort((a, b) => b.margin - a.margin);
  if (sp.topic === "detention") lanes = [...lanes].sort((a, b) => (b.costByKind.detention ?? 0) - (a.costByKind.detention ?? 0));
  if (sp.topic === "fees") lanes = [...lanes].sort((a, b) => (b.costByKind.fee ?? 0) - (a.costByKind.fee ?? 0));
  if (sp.topic === "fuel") lanes = [...lanes].sort((a, b) => (b.costByKind.fuel ?? 0) - (a.costByKind.fuel ?? 0));

  const weekLink = (topic?: string) =>
    `/answers?week=${answer.meta.weekStart}${topic ? `&topic=${topic}` : ""}`;
  const money = (v: number) => `$${v.toFixed(2)}`;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold ds-text">Lane margins</h1>
        <WeekPicker current={answer.meta.weekStart} />
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <a href={`/api/answers/export?week=${answer.meta.weekStart}`} className="underline ds-text">
          Download CSV
        </a>
        <ShareButton week={answer.meta.weekStart} />
        <Link href="/help" className="underline ds-text-2">How to read this</Link>
      </div>
      <NlBox week={answer.meta.weekStart} />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Lane views">
        <Link
          href={weekLink()}
          aria-current={!sp.topic ? "page" : undefined}
          className="ds-state rounded border px-2 py-1 text-sm ds-text-2"
          style={!sp.topic ? { borderColor: "var(--accent)" } : { borderColor: "var(--hairline)" }}
        >
          All lanes
        </Link>
        {TOPICS.map(([key, label]) => (
          <Link
            key={key}
            href={weekLink(key)}
            aria-current={sp.topic === key ? "page" : undefined}
            className="ds-state rounded border px-2 py-1 text-sm ds-text-2"
            style={sp.topic === key ? { borderColor: "var(--accent)" } : { borderColor: "var(--hairline)" }}
          >
            {label}
          </Link>
        ))}
      </div>

      {lanes.length === 0 ? (
        <div className="rounded border p-6 text-center ds-panel" style={{ borderColor: "var(--hairline)" }}>
          <p className="font-medium ds-text">No loads this week.</p>
          <p className="mt-1 text-sm ds-text-2">
            <Link href="/upload" className="underline">
              Upload an export
            </Link>{" "}
            to get your first answer — most teams see one in under a day.
          </p>
        </div>
      ) : (
        <>
          <ProofStrip
            items={[
              { label: "Revenue", value: money(answer.totals.revenue) },
              { label: "Cost", value: money(answer.totals.cost) },
              { label: "Margin", value: money(answer.totals.margin) },
              {
                label: "Margin %",
                value: answer.totals.marginPct === null ? "—" : `${answer.totals.marginPct}%`,
                detail: `${answer.totals.loads} loads · ${answer.meta.currency} · ${answer.meta.distanceUnit}`,
              },
            ]}
          />
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Delta label="Revenue WoW" value={prev ? answer.totals.revenue - prev.totals.revenue : null} format={money} />
            <Delta label="Margin WoW" value={prev ? answer.totals.margin - prev.totals.margin : null} format={money} />
          </p>
          <DataTable
            caption={`Lane margins, week of ${answer.meta.weekStart}`}
            columns={[
              { label: "Lane" },
              { label: "Loads", numeric: true },
              { label: "Revenue", numeric: true },
              { label: "Cost", numeric: true },
              { label: "Margin", numeric: true },
              { label: "Margin %", numeric: true },
            ]}
            rows={lanes.map((l) => [
              <Link
                key={`lane-${l.lane}`}
                href={`/answers/lane?lane=${encodeURIComponent(l.lane)}&week=${answer.meta.weekStart}`}
                className="underline"
              >
                {l.lane}
              </Link>,
              <span key={`loads-${l.lane}`}>{l.loads}</span>,
              <span key={`rev-${l.lane}`}>${l.revenue.toFixed(2)}</span>,
              <span key={`cost-${l.lane}`}>${l.cost.toFixed(2)}</span>,
              <span
                key={`margin-${l.lane}`}
                className="font-medium"
                style={{ color: l.margin < 0 ? "var(--danger)" : "var(--success)" }}
                aria-label={`margin ${l.margin < 0 ? "loss" : "profit"} $${l.margin.toFixed(2)}`}
              >
                <span aria-hidden>{l.margin < 0 ? "▼ " : "▲ "}</span>${l.margin.toFixed(2)}
              </span>,
              <span key={`pct-${l.lane}`}>{l.marginPct === null ? "—" : `${l.marginPct}%`}</span>,
            ])}
          />
        </>
      )}

      <section className="rounded border p-4 text-sm ds-panel" style={{ borderColor: "var(--hairline)" }}>
        <h2 className="font-medium ds-text">How this answer was built</h2>
        <ul className="mt-1 list-disc pl-5 ds-text-2">
          {answer.appliedRules.map((r) => (
            <li key={r.id}>
              <Link href="/rules" className="font-mono underline" title="Open standing rules">
                {r.id}
              </Link>{" "}
              — {r.sentence}
            </li>
          ))}
        </ul>
        <p className="mt-2 ds-text-2">
          Week {answer.meta.weekStart} → {answer.meta.weekEnd} · data as of{" "}
          {answer.meta.dataAsOf ? new Date(answer.meta.dataAsOf).toLocaleString() : "—"} · engine{" "}
          {answer.meta.engineVersion}
        </p>
      </section>
    </main>
  );
}
