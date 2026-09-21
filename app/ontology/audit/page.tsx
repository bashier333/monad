import Link from "next/link";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";
import { verifyEventChain } from "@/lib/core/ontology/facts";
import AuditBoard from "@/app/ontology/audit/board";

async function gate() {
  const session = await auth();
  if (!session?.user?.id) return { gate: "signin" as const };
  const active = await getActiveOrg(session.user.id);
  if (!active) return { gate: "noorg" as const };
  return { gate: "ok" as const, orgId: active.organization.id };
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ objectId?: string }> }) {
  const sp = await searchParams;
  const objectFilter = (sp.objectId ?? "").trim() || undefined;
  const g = await gate();
  if (g.gate !== "ok") {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>
          <Link href="/api/auth/signin" className="underline">
            Sign in
          </Link>{" "}
          to open the audit trail.
        </p>
      </main>
    );
  }
  const [events, chain] = await Promise.all([
    db.ontoEvent.findMany({
      where: { organizationId: g.orgId, ...(objectFilter ? { objectId: objectFilter } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, kind: true, objectId: true, actorId: true, before: true, after: true, prevHash: true, hash: true, createdAt: true },
    }),
    verifyEventChain(g.orgId, 5000),
  ]);
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <p className="text-sm">
        <Link href="/ontology" className="underline">
          Studio
        </Link>{" "}
        / Audit
      </p>
      <h1 className="text-xl font-bold ds-text">Audit trail</h1>
      <p className="text-sm ds-text-2">
        Every change, who made it, and the before-and-after — each entry cryptographically links to the
        previous one, so tampering anywhere breaks verification everywhere after it.
      </p>
      <AuditBoard
        initial={events.map((e) => ({
          id: e.id,
          kind: e.kind,
          objectId: e.objectId,
          actorId: e.actorId,
          before: e.before as Record<string, unknown> | null,
          after: e.after as Record<string, unknown> | null,
          prevHash: e.prevHash,
          hash: e.hash,
          createdAt: e.createdAt.toISOString(),
        }))}
        chain={chain}
        initialObjectId={objectFilter ?? ""}
      />
    </main>
  );
}
