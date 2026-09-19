import Link from "next/link";
import DemoSeedButton from "@/components/DemoSeedButton";
import { packManifests } from "@/lib/packs/register";
import { auth } from "@/lib/core/auth";
import { getActiveOrg } from "@/lib/core/org";

export default async function PacksPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>
          <Link href="/api/auth/signin" className="underline">
            Sign in
          </Link>{" "}
          to browse packs.
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
  const settings = (active.organization.settings ?? {}) as { enabledPacks?: string[] };
  const enabled = new Set(settings.enabledPacks ?? ["freight", "agency"]);

  const seedPack = (id: string): string => (id === "agency" ? "agency-video" : "default");
  const answersHref = (id: string): string => (id === "agency" ? "/answers/projects" : "/answers");

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4 md:p-8">
      <h1 className="text-xl font-bold">Pack directory</h1>
      <p className="text-sm text-gray-600">
        Install a pack to get its answers. Data stays namespaced — disabling a pack hides its
        answers but keeps its rows (see deletion process in pack docs).
      </p>
      {packManifests().map((m) => (
        <section key={m.id} className="rounded border p-4 text-sm">
          <h2 className="font-medium">
            {m.name} <span className="text-gray-500">v{m.version}</span>
          </h2>
          <p className="mt-1 text-gray-700">
            Entities: {m.entities.join(", ")} · Sources: {m.sources.join(", ")}
          </p>
          <p className="mt-1 text-gray-700">
            Vocabulary: {m.vocabulary.group}s, {m.vocabulary.records}, weekly {m.vocabulary.money}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {enabled.has(m.id) ? (
              <>
                <span className="text-green-700">Installed</span>
                <Link href={answersHref(m.id)} className="underline">
                  Open answers
                </Link>
              </>
            ) : (
              <span className="text-gray-500">Disabled in settings</span>
            )}
            <DemoSeedButton pack={seedPack(m.id)} label={`Try the ${m.id} sample`} />
            <Link href="/settings" className="underline">
              Manage in settings
            </Link>
          </div>
        </section>
      ))}
    </main>
  );
}
