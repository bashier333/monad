import Link from "next/link";
import BillingPanel from "@/components/BillingPanel";
import DangerZone from "@/components/DangerZone";
import InviteForm from "@/components/InviteForm";
import OrgSettingsForm from "@/components/OrgSettingsForm";
import OrgSwitcher from "@/components/OrgSwitcher";
import ProviderKeyForm from "@/components/ProviderKeyForm";
import HubNav, { HUBS } from "@/components/HubNav";
import SessionsButton from "@/components/SessionsButton";
import { PageHeader } from "@/components/primitives";
import { auth } from "@/lib/core/auth";
import { getActiveOrg } from "@/lib/core/org";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>
          <Link href="/signin" className="underline">
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
  const settings = (active.organization.settings ?? {}) as {
    anomalyThresholdPts?: number;
    anomalyEmail?: boolean;
    agencyWeekStartsOn?: number;
    agencyAnomalyThresholdPts?: number;
    agencyAnomalyEmail?: boolean;
    locale?: string;
    predictOptOut?: boolean;
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <PageHeader title={`Settings for ${active.organization.name}`} />
      <HubNav items={[...HUBS.settings]} />
      <section className="rounded border p-4">
        <h2 className="mb-2 font-medium">Organizations</h2>
        <OrgSwitcher currentId={active.organization.id} />
      </section>
      {isOwner ? (
        <>
          <section id="organization" className="rounded border p-4" style={{ scrollMarginTop: "16px" }}>
            <h2 className="mb-2 font-medium">Organization</h2>
            <OrgSettingsForm
              initial={{
                weekStartsOn: active.organization.weekStartsOn,
                timezone: active.organization.timezone,
                anomalyThresholdPts: settings.anomalyThresholdPts ?? 6,
                anomalyEmail: settings.anomalyEmail === true,
                agencyWeekStartsOn: settings.agencyWeekStartsOn ?? active.organization.weekStartsOn,
                agencyAnomalyThresholdPts: settings.agencyAnomalyThresholdPts ?? 6,
                agencyAnomalyEmail: settings.agencyAnomalyEmail === true,
                locale: settings.locale ?? "en",
                predictOptOut: settings.predictOptOut === true,
              }}
            />
          </section>
          <section id="sessions" className="rounded border p-4" style={{ scrollMarginTop: "16px" }}>
            <h2 className="mb-2 font-medium">Sessions</h2>
            <SessionsButton />
          </section>
          <section id="team" className="rounded border p-4" style={{ scrollMarginTop: "16px" }}>
            <h2 className="mb-2 font-medium">Team</h2>
            <InviteForm />
          </section>
          <section id="ai-key" className="rounded border p-4" style={{ scrollMarginTop: "16px" }}>
            <h2 className="mb-2 font-medium">AI provider key</h2>
            <p className="mb-3 text-sm ds-text-2">
              Optional. A workspace key is used for automations instead of the server key.
            </p>
            <ProviderKeyForm />
          </section>
          <section id="billing" className="rounded border p-4" style={{ scrollMarginTop: "16px" }}>
            <h2 className="mb-2 font-medium">Billing</h2>
            <BillingPanel />
          </section>
          <section id="data" className="rounded border p-4" style={{ scrollMarginTop: "16px" }}>
            <h2 className="mb-2 font-medium">Data</h2>
            <DangerZone slug={active.organization.slug} />
          </section>
        </>
      ) : (
        <p className="text-sm ds-text-2">Only owners can change settings. Ask an owner to invite or update.</p>
      )}
    </main>
  );
}
