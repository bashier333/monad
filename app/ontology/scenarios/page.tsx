import Link from "next/link";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";
import ScenarioManager from "@/app/ontology/scenarios/manager";

async function gate() {
  const session = await auth();
  if (!session?.user?.id) return { gate: "signin" as const };
  const active = await getActiveOrg(session.user.id);
  if (!active) return { gate: "noorg" as const };
  return { gate: "ok" as const, orgId: active.organization.id };
}

export default async function ScenariosPage() {
  const g = await gate();
  if (g.gate !== "ok") {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>
          <Link href="/signin" className="underline">
            Sign in
          </Link>{" "}
          to open scenarios.
        </p>
      </main>
    );
  }
  const branches = await db.ontoBranch.findMany({
    where: { organizationId: g.orgId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const serial = branches.map((b) => ({
    name: b.name,
    status: b.status,
    changes: (b.changes as Array<{ objectId: string; baseVersion: number; data: Record<string, unknown> }>) ?? [],
    createdAt: b.createdAt.toISOString().slice(0, 10),
  }));
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <p className="text-sm">
        <Link href="/ontology" className="underline">
          Studio
        </Link>{" "}
        / Scenarios
      </p>
      <h1 className="text-xl font-bold ds-text">Branch scenarios</h1>
      <p className="text-sm ds-text-2">
        Safe what-ifs. Stage changes on a branch, preview their impact, compare two futures side by side,
        and merge only when satisfied — the live model stays untouched until then.
      </p>
      <ScenarioManager initial={serial} />
    </main>
  );
}
