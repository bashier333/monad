import Link from "next/link";
import DecideButtons from "@/components/DecideButtons";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";

const TABS = ["open", "applied", "rejected", "reverted", "all"] as const;

// Correction queue: per-tab counts, target filter (?target= deep-links from
// lane cost drivers), no-reload decide, role banner up front.
export default async function CorrectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; target?: string }>;
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
          to review corrections.
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

  const status = sp.status ?? "open";
  const target = (sp.target ?? "").trim();
  const [counts, corrections] = await Promise.all([
    db.correction.groupBy({
      by: ["status"],
      where: { organizationId: active.organization.id },
      _count: { status: true },
    }),
    db.correction.findMany({
      where: {
        organizationId: active.organization.id,
        ...(status === "all" ? {} : { status }),
        ...(target ? { targetKey: { contains: target } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);
  const countBy = new Map(counts.map((c) => [c.status, c._count.status]));
  const tabHref = (s: string) => `/corrections?status=${s}${target ? `&target=${encodeURIComponent(target)}` : ""}`;
  const canDecide = active.membership.role === "OWNER";

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4 md:p-8">
      <h1 className="text-xl font-bold ds-text">Correction queue</h1>
      {!canDecide && (
        <p className="rounded border p-3 text-sm ds-panel" style={{ borderColor: "var(--hairline)" }}>
          <span className="font-medium ds-text">Viewer role:</span>{" "}
          <span className="ds-text-2">
            you can flag figures from any lane, but only owners can apply or reject corrections.
          </span>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {TABS.map((s) => (
          <Link
            key={s}
            href={tabHref(s)}
            aria-current={status === s ? "page" : undefined}
            className={`underline ds-text ${status === s ? "font-bold" : ""}`}
          >
            {s} ({s === "all" ? corrections.length : (countBy.get(s) ?? 0)})
          </Link>
        ))}
        <form method="get" className="ml-auto flex gap-2" role="search" aria-label="Filter by load">
          <input type="hidden" name="status" value={status} />
          <label htmlFor="target-q" className="sr-only">Filter by load key</label>
          <input
            id="target-q"
            name="target"
            defaultValue={target}
            placeholder="Filter by load…"
            autoComplete="off"
            className="ds-control rounded border px-2 py-1 text-sm ds-text"
            style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
          />
          <button type="submit" className="rounded border px-2 py-1 text-sm ds-text" style={{ borderColor: "var(--hairline)" }}>
            Filter
          </button>
        </form>
      </div>
      {target && (
        <p className="text-sm ds-text-2">
          Filtered to “{target}”. <Link href={`/corrections?status=${status}`} className="underline">Clear</Link>
        </p>
      )}
      {corrections.length === 0 ? (
        <p className="text-sm ds-text-2">Nothing here. Flag a figure from any lane to start the trail.</p>
      ) : (
        <div className="overflow-x-auto rounded ds-panel" role="region" aria-label="Corrections" tabIndex={0}>
        <table className="ds-table w-full min-w-[640px] text-sm">
          <thead className="sticky top-0" style={{ background: "var(--panel)" }}>
            <tr className="text-left">
              <th scope="col" className="py-1 font-medium ds-text-2">Load</th>
              <th scope="col" className="font-medium ds-text-2">Field</th>
              <th scope="col" className="font-medium ds-text-2">→ New</th>
              <th scope="col" className="font-medium ds-text-2">Reason</th>
                <th scope="col" className="font-medium ds-text-2">Status</th>
                {canDecide && <th scope="col" className="font-medium ds-text-2">Decide</th>}
            </tr>
          </thead>
          <tbody>
            {corrections.map((c) => (
              <tr key={c.id} className="border-t" style={{ borderColor: "var(--hairline)" }}>
                <td className="py-1 font-mono ds-text">{c.targetKey}</td>
                <td className="ds-text-2">{c.field}</td>
                <td className="ds-text-2">{c.newValue || "—"}</td>
                <td className="max-w-xs truncate ds-text-2" title={c.reason}>{c.reason}</td>
                <td className="ds-text-2">{c.status}</td>
                {canDecide && (
                  <td>
                    <DecideButtons id={c.id} status={c.status} />{" "}
                    <Link
                      href={`/rules?fromCorrection=${c.id}&matchValue=${encodeURIComponent(c.targetKey)}&toLoad=${encodeURIComponent(c.newValue || "EXCLUDE")}&reason=${encodeURIComponent(c.reason)}`}
                      className="text-xs underline ds-text-2"
                    >
                      make rule
                    </Link>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </main>
  );
}
