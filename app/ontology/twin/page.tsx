import Link from "next/link";
import { auth } from "@/lib/core/auth";
import { getActiveOrg } from "@/lib/core/org";
import { clearanceForRole, twinGraph, twinOverview } from "@/lib/packs/manufacturing/service";
import SeedPack from "@/app/ontology/twin/seed-pack";
import TwinBoard from "@/app/ontology/twin/board";

async function gate() {
  const session = await auth();
  if (!session?.user?.id) return { gate: "signin" as const };
  const active = await getActiveOrg(session.user.id);
  if (!active) return { gate: "noorg" as const };
  return { gate: "ok" as const, orgId: active.organization.id, isOwner: active.membership.role === "OWNER", role: active.membership.role };
}

export default async function TwinPage() {
  const g = await gate();
  if (g.gate !== "ok") {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>
          <Link href="/signin" className="underline">
            Sign in
          </Link>{" "}
          to open the digital twin.
        </p>
      </main>
    );
  }
  // Every source degrades independently: a query failure renders a
  // retry state, never a dead page.
  const [overview, graph] = await Promise.all([
    twinOverview(g.orgId, { clearance: clearanceForRole(g.role) }).catch(() => null),
    twinGraph(g.orgId).catch(() => null),
  ]);
  if (!overview || !graph) {
    return (
      <main className="mx-auto max-w-2xl space-y-3 p-8">
        <h1 className="text-xl font-bold ds-text">Manufacturing digital twin</h1>
        <p className="text-sm ds-text-2">
          The twin data is temporarily unavailable. Reload to try again — your model is safe.
        </p>
      </main>
    );
  }
  const c = overview.counts;
  const hasModel = c.plants + c.warehouses + c.products + c.lots + c.shipments + c.customers > 0;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <p className="text-sm">
        <Link href="/ontology" className="underline">
          Studio
        </Link>{" "}
        / Digital twin
      </p>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold ds-text">Manufacturing digital twin</h1>
          <p className="mt-1 text-sm ds-text-2">
            What each site holds, what is moving, and who is exposed — read the three decision lists top to
            bottom when something needs attention.
          </p>
        </div>
        {g.isOwner && <SeedPack />}
      </div>

      {!hasModel && (
        <p className="rounded border border-dashed p-4 text-sm ds-text-2" style={{ borderColor: "var(--hairline)" }}>
          No manufacturing objects yet. Seed the pack, then import the mfg-* fixtures (or create objects through the
          API) to see coverage and risk.
        </p>
      )}

      {hasModel && <TwinBoard overview={overview} graph={graph} />}
    </main>
  );
}
