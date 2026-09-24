import Link from "next/link";
import { auth } from "@/lib/core/auth";
import { getActiveOrg } from "@/lib/core/org";
import { resolveWeek } from "@/lib/core/answers/service";
import { twinOverview, twinGraph } from "@/lib/packs/manufacturing/service";
import { agencyBoard, freightBoard } from "@/lib/packs/board";
import { db } from "@/lib/core/db";
import { EmptyState } from "@/components/primitives";
import HubNav, { HUBS } from "@/components/HubNav";
import BoardView from "./view";

export const metadata = { title: "Operations board - Monad" };

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ pack?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <EmptyState
          title="Sign in to open the operations board"
          body="Trucks, factories, routes, and shipments appear here once you are signed in."
          actionHref="/api/auth/signin"
          actionLabel="Sign in"
        />
      </main>
    );
  }
  const active = await getActiveOrg(session.user.id);
  if (!active) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <EmptyState
          title="No organization yet"
          body="Create or join an organization and the board fills with its operation."
          actionHref="/settings"
          actionLabel="Open settings"
        />
      </main>
    );
  }
  const orgId = active.organization.id;
  const anchor = resolveWeek(null);
  const pack = sp.pack === "freight" || sp.pack === "manufacturing" || sp.pack === "agency" ? sp.pack : "all";

  // Every source degrades independently: a pack with no data renders its
  // empty card, never a dead page.
  const [overview, graph, freight, agency, pending, recentRuns] = await Promise.all([
    twinOverview(orgId).catch(() => null),
    twinGraph(orgId).catch(() => null),
    freightBoard(orgId, active.organization.weekStartsOn, anchor).catch(() => null),
    agencyBoard(orgId, active.organization.weekStartsOn, anchor).catch(() => null),
    db.ontoApproval.count({ where: { organizationId: orgId, status: "pending" } }).catch(() => 0),
    db.importRun.count({ where: { organizationId: orgId } }).catch(() => 0),
  ]);

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight ds-text">Operations board</h1>
          <p className="mt-1 text-sm ds-text-2">
            Every moving part of the company on one board. Click anything to open its evidence.
          </p>
        </div>
        <div className="flex gap-1 text-sm" role="group" aria-label="Business view">
          {(
            [
              ["all", "Everything"],
              ["freight", "Freight"],
              ["manufacturing", "Factories"],
              ["agency", "Studio"],
            ] as const
          ).map(([key, label]) => (
            <Link
              key={key}
              href={key === "all" ? "/ontology/board" : `/ontology/board?pack=${key}`}
              aria-current={pack === key ? "page" : undefined}
              className="ds-state rounded-md border px-2.5 py-1.5"
              style={
                pack === key
                  ? { borderColor: "var(--accent)", color: "var(--accent)", fontWeight: 600 }
                  : { borderColor: "var(--hairline)" }
              }
            >
              <span className={pack === key ? "" : "ds-text-2"}>{label}</span>
            </Link>
          ))}
        </div>
      </div>
      <HubNav items={[...HUBS.board]} />
      <BoardView
        pack={pack}
        overview={overview}
        graph={graph}
        freight={freight}
        agency={agency}
        pending={pending}
        hasRuns={recentRuns > 0}
      />
    </main>
  );
}
