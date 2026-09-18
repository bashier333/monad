import Link from "next/link";
import BillingPanel from "@/components/BillingPanel";
import DangerZone from "@/components/DangerZone";
import InviteForm from "@/components/InviteForm";
import OrgSettingsForm from "@/components/OrgSettingsForm";
import { auth } from "@/lib/core/auth";
import { getActiveOrg } from "@/lib/core/org";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>
          <Link href="/api/auth/signin" className="underline">
            Sign in
          </Link>{" "}
          to manage settings.
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
  const isOwner = active.membership.role === "OWNER";
  const settings = (active.organization.settings ?? {}) as { anomalyThresholdPts?: number; anomalyEmail?: boolean };

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <h1 className="text-xl font-bold">Settings — {active.organization.name}</h1>
      {isOwner ? (
        <>
          <section className="rounded border p-4">
            <h2 className="mb-2 font-medium">Organization</h2>
            <OrgSettingsForm
              initial={{
                weekStartsOn: active.organization.weekStartsOn,
                timezone: active.organization.timezone,
                anomalyThresholdPts: settings.anomalyThresholdPts ?? 6,
                anomalyEmail: settings.anomalyEmail === true,
              }}
            />
          </section>
          <section className="rounded border p-4">
            <h2 className="mb-2 font-medium">Team</h2>
            <InviteForm />
          </section>
          <section className="rounded border p-4">
            <h2 className="mb-2 font-medium">Billing</h2>
            <BillingPanel />
          </section>
          <section className="rounded border p-4">
            <h2 className="mb-2 font-medium">Data</h2>
            <DangerZone slug={active.organization.slug} />
          </section>
        </>
      ) : (
        <p className="text-sm text-gray-600">Only owners can change settings. Ask an owner to invite or update.</p>
      )}
    </main>
  );
}
