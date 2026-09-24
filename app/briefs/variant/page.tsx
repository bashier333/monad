import Link from "next/link";
import { resolveWeek } from "@/lib/core/answers/service";
import { buildVariant, type VariantBy } from "@/lib/packs/freight/brief/variants";
import { buildAgencyVariant, type AgencyVariantBy } from "@/lib/packs/agency/brief/variants";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";

const FREIGHT_BYS: VariantBy[] = ["driver", "truck", "broker", "customer", "day", "month"];
const AGENCY_BYS: AgencyVariantBy[] = ["client", "producer", "day", "month"];

export default async function VariantPage({
  searchParams,
}: {
  searchParams: Promise<{ by?: string; key?: string; week?: string; pack?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>
          <Link href="/signin" className="underline">Sign in</Link> to see briefs.
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

  const by = (sp.by ?? "") as VariantBy & AgencyVariantBy;
  const key = sp.key ?? "";
  const pack = sp.pack === "agency" ? "agency" : "freight";
  const allowed = pack === "agency" ? AGENCY_BYS : FREIGHT_BYS;
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
  if (!allowed.includes(by) || !key) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>Pick a variant from <Link href="/briefs" className="underline">briefs</Link>.</p>
      </main>
    );
  }

  const openCorrections = await db.correction.count({
    where: { organizationId: active.organization.id, status: "open" },
  });
  const c =
    pack === "agency"
      ? await buildAgencyVariant(active.organization.id, active.organization.weekStartsOn, anchor, by as AgencyVariantBy, key, openCorrections)
      : await buildVariant(active.organization.id, active.organization.weekStartsOn, anchor, by as VariantBy, key, openCorrections);

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 md:p-8">
      <p className="text-sm">
        <Link href="/briefs" className="underline">← All briefs</Link>
      </p>
      <h1 className="text-xl font-bold">
        {by}: {key} <span className="text-sm font-normal ds-text-2">({c.weekStart})</span>
      </h1>
      <p className="rounded border p-4">{c.paragraph}</p>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="rounded border p-2">Revenue: ${c.totals.revenue.toFixed(2)}</div>
        <div className="rounded border p-2">Cost: ${c.totals.cost.toFixed(2)}</div>
        <div className="rounded border p-2">Margin: ${c.totals.margin.toFixed(2)}</div>
      </div>
    </main>
  );
}
