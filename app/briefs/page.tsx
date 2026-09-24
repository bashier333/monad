import Link from "next/link";
import GenerateBriefButton from "@/components/GenerateBriefButton";
import VariantForm from "@/components/VariantForm";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";

export default async function BriefsPage({
  searchParams,
}: {
  searchParams: Promise<{ pack?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>
          <Link href="/signin" className="underline">
            Sign in
          </Link>{" "}
          to see briefs.
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

  const sp = await searchParams;
  const pack = sp.pack === "agency" ? "agency" : "freight";
  const briefs = await db.brief.findMany({
    where: { organizationId: active.organization.id, pack },
    orderBy: { weekStart: "desc" },
    take: 52,
    select: { id: true, weekStart: true, createdAt: true, content: true },
  });

  const marginOf = (b: { content: unknown }): string | null => {
    try {
      const totals = (b.content as { totals?: { margin?: number } })?.totals;
      return typeof totals?.margin === "number" ? `$${totals.margin.toFixed(2)}` : null;
    } catch {
      return null;
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Monday briefs ({pack === "agency" ? "studio" : "fleet"})</h1>
        <GenerateBriefButton pack={pack} />
      </div>
      <p className="text-sm">
        {pack === "agency" ? (
          <Link href="/briefs" className="underline">Fleet briefs →</Link>
        ) : (
          <Link href="/briefs?pack=agency" className="underline">Studio briefs →</Link>
        )}
      </p>
      <VariantForm week={new Date().toISOString().slice(0, 10)} pack={pack} />
      {briefs.length === 0 ? (
        <p className="text-sm ds-text-2">No briefs yet. Generate the first one above.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {briefs.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3 ds-panel" style={{ borderColor: "var(--hairline)" }}>
              <Link href={`/briefs/${b.weekStart}?pack=${pack}`} className="underline ds-text">
                Week of {b.weekStart}
              </Link>
              {marginOf(b) && <span className="font-mono text-sm ds-text-2">margin {marginOf(b)}</span>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
