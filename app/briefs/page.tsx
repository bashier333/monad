import Link from "next/link";
import GenerateBriefButton from "@/components/GenerateBriefButton";
import VariantForm from "@/components/VariantForm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveOrg } from "@/lib/org";

export default async function BriefsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>
          <Link href="/api/auth/signin" className="underline">
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

  const briefs = await db.brief.findMany({
    where: { organizationId: active.organization.id },
    orderBy: { weekStart: "desc" },
    take: 52,
    select: { id: true, weekStart: true, createdAt: true },
  });

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Monday briefs</h1>
        <GenerateBriefButton />
      </div>
      <VariantForm week={new Date().toISOString().slice(0, 10)} />
      {briefs.length === 0 ? (
        <p className="text-sm text-gray-600">No briefs yet. Generate the first one above.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {briefs.map((b) => (
            <li key={b.id} className="rounded border p-3">
              <Link href={`/briefs/${b.weekStart}`} className="underline">
                Week of {b.weekStart}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
