import Link from "next/link";
import { auth } from "@/lib/core/auth";
import { getActiveOrg } from "@/lib/core/org";
import Explorer from "@/app/ontology/explore/explorer";

export default async function ExplorePage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <Link href="/signin" className="underline">
          Sign in
        </Link>
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
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4 md:p-8">
      <p className="text-sm">
        <Link href="/ontology" className="underline">
          Studio
        </Link>{" "}
        / Explore
      </p>
      <h1 className="text-xl font-bold ds-text">Graph explorer</h1>
      <p className="text-sm ds-text-2">
        Find anything, then follow its relationships outward. Depth controls how many hops you see; every
        object can jump straight into an action.
      </p>
      <Explorer canManage={active.membership.role === "OWNER"} />
    </main>
  );
}
