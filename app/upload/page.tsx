import Link from "next/link";
import FleetSizePicker from "@/components/FleetSizePicker";
import OnboardingChecklist, { type ChecklistState } from "@/components/OnboardingChecklist";
import UploadForm from "@/components/UploadForm";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";
import { FREE_LIMITS, monthlyUploads } from "@/lib/core/billing";

// Upload first, context after: the form sits above the fold, one Try-sample
// beside it, business selectors and checklists below. History filters
// server-side via ?q= so no client JS is needed for search.
export default async function UploadPage({ searchParams }: { searchParams: Promise<{ q?: string; next?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>
          <Link href="/signin" className="underline">
            Sign in
          </Link>{" "}
          to upload.
        </p>
      </main>
    );
  }
  const active = await getActiveOrg(session.user.id);
  if (!active) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>No organization yet. Ask an admin to invite you.</p>
      </main>
    );
  }
  const { q, next } = await searchParams;
  const query = (q ?? "").trim();
  const boardHref = next?.startsWith("/") && !next.startsWith("//") ? next : "/ontology/board";

  const [runs, mappingCount, stagedOk, correctionCount, uploadsThisMonth] = await Promise.all([
    db.importRun.findMany({
      where: {
        organizationId: active.organization.id,
        ...(query ? { file: { filename: { contains: query } } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { file: { select: { filename: true } } },
    }),
    db.columnMapping.count({ where: { organizationId: active.organization.id } }),
    db.stagedRecord.count({ where: { organizationId: active.organization.id, status: "ok" } }),
    db.correction.count({ where: { organizationId: active.organization.id } }),
    monthlyUploads(active.organization.id),
  ]);
  const checklist: ChecklistState = {
    uploaded: runs.length > 0,
    mappingConfirmed: mappingCount > 0,
    answerReady: stagedOk > 0,
    correctionMade: correctionCount > 0,
  };
  const fleetSize = ((active.organization.settings ?? {}) as { fleetSize?: string }).fleetSize ?? "";
  const teamSize = ((active.organization.settings ?? {}) as { teamSize?: string }).teamSize ?? "";
  const staleCutoff = Date.now() - 10 * 60 * 1000;
  const stuck = runs.filter((r) => (r.status === "PENDING" || r.status === "PROCESSING") && new Date(r.createdAt).getTime() < staleCutoff);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-xl font-bold">Connect your data for {active.organization.name}</h1>
        <p className="mt-1 text-sm ds-text-2">
          Upload a file or sync a connector, then watch it land on{" "}
          <Link href={boardHref} className="underline ds-text">your board</Link>.
        </p>
      </div>
      <ol className="flex flex-wrap gap-2 text-[13px]" aria-label="Setup progress">
        {[
          { label: "1 · Connect", done: checklist.uploaded, href: null },
          { label: "2 · Map columns", done: checklist.mappingConfirmed, href: null },
          { label: "3 · See the board", done: checklist.answerReady, href: boardHref },
        ].map((s) => (
          <li
            key={s.label}
            className="rounded-full border px-3 py-1"
            style={{
              borderColor: "var(--hairline)",
              background: s.done ? "var(--success)" : "var(--panel)",
              color: s.done ? "#fff" : "var(--fg-2)",
            }}
          >
            {s.href && s.done ? <Link href={s.href} className="underline">{s.label} →</Link> : s.done ? `${s.label} ✓` : s.label}
          </li>
        ))}
      </ol>
      <p className="text-sm ds-text-2" role="status">
        {uploadsThisMonth}/{FREE_LIMITS.uploadsPerMonth} free uploads used this month
        {uploadsThisMonth >= FREE_LIMITS.uploadsPerMonth ? (
          <>
            {" — "}<Link href="/pricing" className="underline">Upgrade to Team for unlimited</Link>
          </>
        ) : null}
      </p>
      <div id="upload-form">
        <UploadForm />
      </div>
      <section className="rounded border p-4 text-sm" style={{ borderColor: "var(--hairline)" }}>
        <h2 className="font-medium ds-text">Prefer a live connection?</h2>
        <p className="mt-1 ds-text-2">
          Connectors pull your systems on a schedule, so the board stays current without re-uploading.
        </p>
        <p className="mt-2">
          <Link href="/sync" className="underline ds-text">Open connectors →</Link>
        </p>
      </section>
      {stuck.length > 0 && (
        <p className="rounded border p-3 text-sm ds-panel" style={{ borderColor: "var(--warn)" }}>
          {stuck.length} run{stuck.length === 1 ? "" : "s"} stuck over 10 min. The stale-run sweep resets dead
          runs automatically — or{" "}
          <a href="#upload-form" className="underline">re-upload the file</a>, or{" "}
          <Link href="/help" className="underline">read the import runbook</Link>.
        </p>
      )}
      <section className="rounded border p-4 text-sm" style={{ borderColor: "var(--hairline)" }}>
        <h2 className="font-medium ds-text">Which business is this for?</h2>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <Link href="/answers" className="ds-state rounded border p-3" style={{ borderColor: "var(--hairline)" }}>
            <span className="font-medium ds-text">Fleet / carriers</span>
            <span className="block ds-text-2">Lane margins from TMS, fuel + broker files.</span>
          </Link>
          <Link href="/answers/projects" className="ds-state rounded border p-3" style={{ borderColor: "var(--hairline)" }}>
            <span className="font-medium ds-text">Video studio / agency</span>
            <span className="block ds-text-2">Project margins from time, revision + invoice exports.</span>
          </Link>
        </div>
      </section>
      <FleetSizePicker initial={fleetSize} />
      <FleetSizePicker initial={teamSize} pack="agency" />
      <OnboardingChecklist state={checklist} />
      <OnboardingChecklist state={checklist} pack="agency" />
      <p className="text-sm ds-text-2">
        <Link href="/help" className="underline">How uploading works</Link>
      </p>
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium ds-text">Import history</h2>
          <form method="get" className="flex gap-2" role="search" aria-label="Filter imports">
            <label htmlFor="history-q" className="sr-only">Filter by filename</label>
            <input
              id="history-q"
              name="q"
              defaultValue={query}
              placeholder="Filter by filename…"
              autoComplete="off"
              className="ds-control rounded border px-2 py-1 text-sm ds-text"
              style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
            />
            <button type="submit" className="rounded border px-2 py-1 text-sm ds-text" style={{ borderColor: "var(--hairline)" }}>
              Filter
            </button>
          </form>
        </div>
        {runs.length === 0 ? (
          <p className="mt-1 text-sm ds-text-2">
            {query ? `No imports match “${query}”.` : "No imports yet. Upload a file above to start."}
          </p>
        ) : (
        <div className="overflow-x-auto rounded ds-panel" role="region" aria-label="Import history" tabIndex={0}>
        <table className="ds-table mt-2 w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left">
              <th scope="col" className="py-1 font-medium ds-text-2">File</th>
              <th scope="col" className="font-medium ds-text-2">Type</th>
              <th scope="col" className="font-medium ds-text-2">Status</th>
              <th scope="col" className="font-medium ds-text-2">Rows ok / quarantined</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-t" style={{ borderColor: "var(--hairline)" }}>
                <td className="py-1">
                  <Link href={`/imports/${r.id}`} className="underline ds-text">
                    {r.file.filename}
                  </Link>
                </td>
                <td className="ds-text-2">{r.sourceType}</td>
                <td className="ds-text-2">
                  {r.status} ({r.progress}%)
                </td>
                <td className="ds-text-2">
                  {r.okRows} / {r.quarantinedRows}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        )}
      </section>
    </main>
  );
}
