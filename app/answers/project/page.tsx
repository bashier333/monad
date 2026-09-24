import Link from "next/link";
import BulkFlag from "@/components/BulkFlag";
import RecomputeButton from "@/components/RecomputeButton";
import RevisionRow, { type RevisionHistory } from "@/components/RevisionRow";
import { getAgencyAnswer } from "@/lib/packs/agency/service";
import { resolveWeek } from "@/lib/core/answers/service";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";
import { AGENCY_SOURCE_TYPES } from "@/lib/packs/agency/sources";

export default async function AgencyProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; week?: string; n?: string }>;
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
  if (!sp.project) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>
          Missing project. <Link href="/answers/projects" className="underline">Back to projects</Link>.
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

  const settings = (active.organization.settings ?? {}) as { agencyWeekStartsOn?: number };
  const weekStartsOn = settings.agencyWeekStartsOn ?? active.organization.weekStartsOn;
  const answer = await getAgencyAnswer(active.organization.id, weekStartsOn, anchor);
  const project = answer.projects.find((p) => p.project === sp.project);
  if (!project) {
    const guess = answer.projects.find((p) => p.project.toLowerCase().includes((sp.project ?? "").toLowerCase()));
    return (
      <main className="mx-auto max-w-2xl space-y-3 p-8">
        <p>No revisions on “{sp.project}” for week of {answer.meta.weekStart}.</p>
        {guess && (
          <p>
            Did you mean{" "}
            <Link
              href={`/answers/project?project=${encodeURIComponent(guess.project)}&week=${answer.meta.weekStart}`}
              className="underline"
            >
              {guess.project}
            </Link>
            ?
          </p>
        )}
        <p>
          <Link href={`/answers/projects?week=${answer.meta.weekStart}`} className="underline">
            ← All projects
          </Link>
        </p>
      </main>
    );
  }

  const limit = Math.min(Math.max(Number(sp.n ?? 100) || 100, 10), 5000);
  const loads = project.loads.slice(0, limit);

  const prevAnchor = new Date(`${answer.meta.weekStart}T00:00:00Z`);
  prevAnchor.setUTCDate(prevAnchor.getUTCDate() - 7);
  const prev = await getAgencyAnswer(
    active.organization.id,
    weekStartsOn,
    prevAnchor.toISOString().slice(0, 10),
  );
  const prevProject = prev.projects.find((p) => p.project === project.project);

  const touched = await db.stagedRecord.findMany({
    where: { organizationId: active.organization.id, loadKey: { in: project.recordKeys.slice(0, 500) } },
    select: { runId: true },
    take: 2000,
  });
  const runs = await db.importRun.findMany({
    where: { id: { in: [...new Set(touched.map((t) => t.runId))] } },
    select: { id: true, sourceType: true, status: true, createdAt: true, file: { select: { filename: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const recentAgencyRuns = await db.importRun.findMany({
    where: {
      organizationId: active.organization.id,
      sourceType: { in: [...AGENCY_SOURCE_TYPES] },
    },
    select: { id: true, sourceType: true, status: true, createdAt: true, file: { select: { filename: true } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const drivers = project.loads
    .flatMap((l) => l.costs.map((c) => ({ loadKey: l.loadKey, label: c.label, amount: c.amount })))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  const correctionRows = await db.correction.findMany({
    where: { organizationId: active.organization.id, targetKey: { in: project.recordKeys.slice(0, 500) } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const historyByLoad = new Map<string, RevisionHistory[]>();
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

  const delta = prevProject ? project.margin - prevProject.margin : null;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <p className="text-sm">
        <Link href={`/answers/projects?week=${answer.meta.weekStart}`} className="underline">
          ← All projects
        </Link>
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{project.project}</h1>
        <RecomputeButton week={answer.meta.weekStart} pack="agency" />
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
        <div className="rounded border p-2">Revenue: ${project.revenue.toFixed(2)}</div>
        <div className="rounded border p-2">Cost: ${project.cost.toFixed(2)}</div>
        <div className="rounded border p-2">Margin: ${project.margin.toFixed(2)}</div>
        <div className="rounded border p-2">
          WoW: {delta === null ? "—" : `${delta >= 0 ? "+" : ""}$${delta.toFixed(2)}`} · {project.revisions} revisions ·{" "}
          {project.client || "no client"}
        </div>
      </div>

      {drivers.length > 0 && (
        <section className="rounded border p-4 text-sm">
          <h2 className="font-medium">Top rework drivers</h2>
          <ul className="mt-1 list-disc pl-5 ds-text">
            {drivers.map((d, i) => (
              <li key={i}>
                {d.label} · ${d.amount.toFixed(2)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <BulkFlag loads={loads.map((l) => ({ loadKey: l.loadKey, kinds: l.costs.map((c) => c.kind) }))} />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
                <tr className="text-left ds-text-2">
              <th className="py-1">Record</th>
              <th>Date</th>
              <th>Person</th>
              <th>Task</th>
              <th className="text-right">Hours</th>
              <th className="text-right">Cost</th>
              <th className="text-right">Margin</th>
              <th>Lines</th>
            </tr>
          </thead>
          <tbody>
            {loads.map((l) => (
              <RevisionRow key={l.loadKey} load={l} history={historyByLoad.get(l.loadKey) ?? []} />
            ))}
          </tbody>
        </table>
      </div>
      {project.loads.length > loads.length && (
        <p className="text-sm">
          <Link
            href={`/answers/project?project=${encodeURIComponent(project.project)}&week=${answer.meta.weekStart}&n=${limit + 100}`}
            className="underline"
          >
            Show more ({project.loads.length - loads.length} remaining)
          </Link>
        </p>
      )}

      <section className="rounded border p-4 text-sm">
        <h2 className="font-medium">Recent imports touching this project</h2>
        <ul className="mt-1 list-disc pl-5 ds-text">
          {runs.map((r) => (
            <li key={r.id}>
              <Link href={`/imports/${r.id}`} className="underline">
                {r.file.filename}
              </Link>{" "}
              ({r.sourceType}, {r.status})
            </li>
          ))}
          {runs.length === 0 && <li>None found.</li>}
        </ul>
      </section>

      <section className="rounded border p-4 text-sm">
        <h2 className="font-medium">Recent agency imports</h2>
        <ul className="mt-1 list-disc pl-5 ds-text">
          {recentAgencyRuns.map((r) => (
            <li key={r.id}>
              <Link href={`/imports/${r.id}`} className="underline">
                {r.file.filename}
              </Link>{" "}
              ({r.sourceType}, {r.status})
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
