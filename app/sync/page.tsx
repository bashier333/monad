import Link from "next/link";
import { auth } from "@/lib/core/auth";
import { getActiveOrg } from "@/lib/core/org";
import { freshnessBadge, listConnectors, prismaConnectorStore } from "@/lib/core/ingest/connector";
import SyncNowButton from "@/components/SyncNowButton";
import "@/lib/core/ingest/connectors";

export const dynamic = "force-dynamic";

export default async function SyncPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>
          <Link href="/signin" className="underline">Sign in</Link> to view sync history.
        </p>
      </main>
    );
  }
  const active = await getActiveOrg(session.user.id);
  if (!active) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>No organization. Join or create one first.</p>
      </main>
    );
  }
  const orgId = active.organization.id;
  const now = Date.now();
  const runs = await prismaConnectorStore.listSyncRuns(orgId, 20).catch(() => []);
  const lastByKey = new Map<string, Date>();
  for (const r of runs) {
    if (!lastByKey.has(r.connectorKey) && r.finishedAt) lastByKey.set(r.connectorKey, new Date(r.finishedAt));
  }
  const connectors = listConnectors();
  return (
    <main className="mx-auto max-w-5xl p-4 md:p-8">
      <h1 className="text-2xl font-bold tracking-tight">Connector sync ledger</h1>
      <p className="mt-2 text-[15px] ds-text-2">
        Every connector pull writes a SyncRun row. Latest 20 below; badges show freshness per connector SLA.
      </p>
      <section className="mt-6 grid gap-2 md:grid-cols-3">
        {connectors.map((c) => (
          <div key={c.key} className="rounded-2xl border  ds-panel p-4">
            <p className="font-semibold">{c.label}</p>
            <p className="mt-1 font-mono text-[12px] ds-text-2">{c.key} · {c.kind}</p>
            <p className="mt-2 text-[13px]">{freshnessBadge(lastByKey.get(c.key) ?? null, now, c.freshnessSlaMs)}</p>
            <SyncNowButton connectorKey={c.key} />
          </div>
        ))}
      </section>
      <h2 className="mt-8 text-lg font-bold">Latest runs</h2>
      {runs.length === 0 ? (
        <p className="mt-2 ds-text-2">No sync runs yet. Run a connector to populate this ledger.</p>
      ) : (
        <ol className="mt-3 divide-y  rounded-2xl border  ds-panel">
          {runs.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 font-mono text-[13px]">
              <span className="font-sans font-semibold">{r.connectorKey}</span>
              <span>{r.status}</span>
              <span>{r.rowsPulled} pulled / {r.rowsUpserted} upserted / {r.rowsQuarantined} quarantined</span>
              {r.degraded && <span>DEGRADED: {(r.degradedSources ?? []).join("; ")}</span>}
              {r.failureReason && <span className="text-red-700">{r.failureReason}</span>}
              <span className="ds-text-2">{new Date(r.startedAt).toISOString()}</span>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
