import Link from "next/link";
import BulkFlag from "@/components/BulkFlag";
import LoadsTable from "@/components/LoadsTable";
import type { FigureHistory } from "@/components/LoadRow";
import RecomputeButton from "@/components/RecomputeButton";
import { ProofStrip } from "@/components/primitives";
import { getWeeklyAnswer } from "@/lib/packs/freight/service"; import { resolveWeek } from "@/lib/core/answers/service";
import { laneKey } from "@/lib/packs/freight/margin/places";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";

export default async function LanePage({
  searchParams,
}: {
  searchParams: Promise<{ lane?: string; week?: string }>;
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
  if (!sp.lane) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>
          Missing lane. <Link href="/answers" className="underline">Back to lanes</Link>.
        </p>
      </main>
    );
  }

  let anchor: string;
  try {
    anchor = resolveWeek(sp.week ?? null);
  } catch {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>Bad week parameter.</p>
      </main>
    );
  }

  const answer = await getWeeklyAnswer(active.organization.id, active.organization.weekStartsOn, anchor);
  const lane = answer.lanes.find((l) => l.lane === sp.lane);
  if (!lane) {
    const guess = answer.lanes.find((l) => l.lane.toLowerCase().includes((sp.lane ?? "").toLowerCase()));
    return (
      <main className="mx-auto max-w-2xl space-y-3 p-8">
        <p>No loads on “{sp.lane}” for week of {answer.meta.weekStart}.</p>
        {guess && (
          <p>
            Did you mean{" "}
            <Link
              href={`/answers/lane?lane=${encodeURIComponent(guess.lane)}&week=${answer.meta.weekStart}`}
              className="underline"
            >
              {guess.lane}
            </Link>
            ?
          </p>
        )}
        <p>
          <Link href={`/answers?week=${answer.meta.weekStart}`} className="underline">
            ← All lanes
          </Link>
        </p>
      </main>
    );
  }

  const loads = answer.loads.filter((l) => laneKey(l.origin, l.destination) === lane.lane);
  const prevAnchor = new Date(`${answer.meta.weekStart}T00:00:00Z`);
  prevAnchor.setUTCDate(prevAnchor.getUTCDate() - 7);
  const prev = await getWeeklyAnswer(
    active.organization.id,
    active.organization.weekStartsOn,
    prevAnchor.toISOString().slice(0, 10),
  );
  const prevLane = prev.lanes.find((l) => l.lane === lane.lane);

  const touched = await db.stagedRecord.findMany({
    where: { organizationId: active.organization.id, loadKey: { in: lane.loadKeys.slice(0, 500) } },
    select: { runId: true },
    take: 2000,
  });
  const runs = await db.importRun.findMany({
    where: { id: { in: [...new Set(touched.map((t) => t.runId))] } },
    select: { id: true, sourceType: true, status: true, createdAt: true, file: { select: { filename: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const drivers = loads
    .flatMap((l) => l.costs.map((c) => ({ loadKey: l.loadKey, label: c.label, amount: c.amount })))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  const correctionRows = await db.correction.findMany({
    where: { organizationId: active.organization.id, targetKey: { in: lane.loadKeys.slice(0, 500) } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const historyByLoad = new Map<string, FigureHistory[]>();
  for (const c of correctionRows) {
    const list = historyByLoad.get(c.targetKey) ?? [];
    list.push({
      field: c.field,
      oldValue: c.oldValue,
      newValue: c.newValue,
      reason: c.reason,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
    });
    historyByLoad.set(c.targetKey, list);
  }

  const wow = prevLane ? Math.round((lane.margin - prevLane.margin) * 100) / 100 : null;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <p className="text-sm ds-text-2">
        <Link href={`/answers?week=${answer.meta.weekStart}`} className="underline">
          ← All lanes
        </Link>{" "}
        · week of {answer.meta.weekStart}
      </p>
      <h1 className="text-xl font-bold ds-text">{lane.lane}</h1>
      <ProofStrip
        items={[
          { label: "Margin", value: `$${lane.margin.toFixed(2)}` },
          { label: "Margin %", value: lane.marginPct === null ? "—" : `${lane.marginPct}%` },
          {
            label: "vs last week",
            value: wow === null ? "no prior week" : `${wow >= 0 ? "+" : ""}$${wow.toFixed(2)}`,
          },
          { label: "Loads", value: String(loads.length) },
        ]}
      />
      <p className="text-sm">
        <a href={`/api/answers/export?week=${answer.meta.weekStart}&lane=${encodeURIComponent(lane.lane)}`} className="underline ds-text">
          Download loads CSV
        </a>
      </p>

      {drivers.length > 0 && (
        <section className="rounded border p-4 text-sm ds-panel" style={{ borderColor: "var(--hairline)" }}>
          <h2 className="font-medium ds-text">Why this lane made (or lost) money: top 3 cost drivers</h2>
          <ol className="mt-1 list-decimal pl-5 ds-text-2">
            {drivers.map((d, i) => (
              <li key={i}>
                {d.label} ${d.amount.toFixed(2)} on load {d.loadKey}{" "}
                <Link href={`/corrections?target=${encodeURIComponent(d.loadKey)}`} className="underline">
                  flags
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="overflow-x-auto rounded ds-panel" role="region" aria-label={`Loads on ${lane.lane}`} tabIndex={0}>
          <table className="ds-table w-full min-w-[720px] text-sm">
          <thead className="sticky top-0" style={{ background: "var(--panel)" }}>
              <tr className="text-left">
              <th scope="col" className="py-1 font-medium ds-text-2">Load</th>
              <th scope="col" className="font-medium ds-text-2">Date</th>
              <th scope="col" className="font-medium ds-text-2">Driver</th>
              <th scope="col" className="font-medium ds-text-2">Truck</th>
              <th scope="col" className="font-medium ds-text-2">Broker</th>
              <th scope="col" className="text-right font-medium ds-text-2">Revenue</th>
              <th scope="col" className="text-right font-medium ds-text-2">Cost</th>
              <th scope="col" className="text-right font-medium ds-text-2">Margin</th>
              <th scope="col" className="font-medium ds-text-2">Lines</th>
            </tr>
          </thead>
          <LoadsTable loads={loads} historyByLoad={Object.fromEntries(historyByLoad)} />
        </table>
      </section>

      <section className="space-y-2 text-sm">
        <RecomputeButton week={answer.meta.weekStart} />
        <BulkFlag loads={loads.map((l) => ({ loadKey: l.loadKey, kinds: l.costs.map((c) => c.kind) }))} />
        {answer.adjustments.length > 0 && (
          <details className="rounded border p-3 ds-panel" style={{ borderColor: "var(--hairline)" }}>
            <summary className="ds-text">Corrections applied this week ({answer.adjustments.length})</summary>
            <ul className="mt-1 list-disc pl-5 ds-text-2">
              {answer.adjustments.map((a, i) => (
                <li key={i}>{a.description}</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="rounded border p-4 text-sm ds-panel" style={{ borderColor: "var(--hairline)" }}>
        <h2 className="font-medium ds-text">Recent imports touching this lane</h2>
        {runs.length === 0 ? (
          <p className="mt-1 ds-text-2">None found.</p>
        ) : (
          <ul className="mt-1 list-disc pl-5 ds-text-2">
            {runs.map((r) => (
              <li key={r.id}>
                <Link href={`/imports/${r.id}`} className="underline">
                  {r.file.filename}
                </Link>{" "}
                ({r.sourceType}, {r.status}, {new Date(r.createdAt).toLocaleDateString()})
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
