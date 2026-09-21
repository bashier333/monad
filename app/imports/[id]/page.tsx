import Link from "next/link";
import ImportDecision from "@/components/ImportDecision";
import ImportProgress from "@/components/ImportProgress";
import MappingReview from "@/components/MappingReview";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";

export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>
          <Link href="/api/auth/signin" className="underline">
            Sign in
          </Link>{" "}
          to view imports.
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

  const run = await db.importRun.findFirst({
    where: { id, organizationId: active.organization.id },
    include: {
      file: { select: { filename: true, bytes: true } },
      rowErrors: { orderBy: { rowNumber: "asc" }, take: 50 },
    },
  });
  if (!run) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>Import not found.</p>
      </main>
    );
  }

  const conflicts = (run.conflicts ?? []) as Array<{
    loadKey: string;
    field: string;
    ours: string;
    theirs: string;
    theirRunId: string;
  }>;

  const samples = await db.stagedRecord.findMany({
    where: { runId: run.id, organizationId: active.organization.id },
    orderBy: { rowNumber: "asc" },
    take: 3,
    select: { rowNumber: true, data: true },
  });

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-8">
      <p className="text-sm">
        <Link href="/upload" className="underline">
          ← All imports
        </Link>
      </p>
      <h1 className="text-xl font-bold">{run.file.filename}</h1>
      <ImportProgress runId={run.id} week={new Date().toISOString().slice(0, 10)} />
      <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
        <div className="rounded border p-2">Status: {run.status}</div>
        <div className="rounded border p-2">Progress: {run.progress}%</div>
        <div className="rounded border p-2">OK rows: {run.okRows}</div>
        <div className="rounded border p-2">Quarantined: {run.quarantinedRows}</div>
      </div>
      {run.failureReason && <p className="text-sm text-red-600">Failed: {run.failureReason}</p>}

      {run.status === "NEEDS_REVIEW" && <ImportDecision runId={run.id} note={run.decisionNote} conflictCount={conflicts.length} />}

      <MappingReview
        runId={run.id}
        headers={(run.headers ?? []) as string[]}
        initialMapping={(run.mapping ?? {}) as Record<string, number>}
        confidence={(run.mappingConfidence ?? {}) as Record<string, number>}
        sourceType={run.sourceType}
        samples={samples.map((s) => ({ rowNumber: s.rowNumber, data: s.data as Record<string, unknown> }))}
      />

      {conflicts.length > 0 && (
        <section className="rounded border p-4">
          <h2 className="font-medium">Conflicts with prior imports ({conflicts.length})</h2>
          <div className="overflow-x-auto">
          <table className="mt-2 w-full min-w-[560px] text-sm">
            <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-1">Record</th>
                <th>Field</th>
                <th>This file</th>
                <th>Prior file</th>
              </tr>
            </thead>
            <tbody>
              {conflicts.slice(0, 50).map((c, i) => (
                <tr key={i} className="border-t">
                  <td className="py-1 font-mono">{c.loadKey}</td>
                  <td>{c.field}</td>
                  <td>{c.ours}</td>
                  <td>{c.theirs}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
      )}

      {run.rowErrors.length > 0 && (
        <section className="rounded border p-4">
          <h2 className="font-medium">Quarantined rows (first {run.rowErrors.length} shown)</h2>
          <p className="mt-1 text-sm">
            <a href={`/api/imports/${run.id}/errors`} className="underline">
              Download all errors as CSV
            </a>{" "}
            — fix offline, re-upload.
          </p>
          <div className="overflow-x-auto">
          <table className="mt-2 w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1">Row</th>
                <th>Issues</th>
              </tr>
            </thead>
            <tbody>
              {run.rowErrors.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="py-1 font-mono">{e.rowNumber}</td>
                  <td>
                    {(e.errors as Array<{ code: string; message: string }>)
                      .map((x) => `${x.code}: ${x.message}`)
                      .join("; ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
      )}
    </main>
  );
}
