import Link from "next/link";
import DemoResetButton from "@/components/DemoResetButton";
import DemoSeedButton from "@/components/DemoSeedButton";
import DemoTour from "@/components/DemoTour";
import FleetSizePicker from "@/components/FleetSizePicker";
import GraduateButton from "@/components/GraduateButton";
import OnboardingChecklist, { type ChecklistState } from "@/components/OnboardingChecklist";
import UploadForm from "@/components/UploadForm";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";

export default async function UploadPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>
          <Link href="/api/auth/signin" className="underline">
            Sign in
          </Link>{" "}
          to upload.
        </p>
      </main>
    );
  }
  const active = await getActiveOrg(session.user.id);
  if (!active) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>No organization yet. Ask an admin to invite you.</p>
      </main>
    );
  }

  const runs = await db.importRun.findMany({
    where: { organizationId: active.organization.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { file: { select: { filename: true } } },
  });

  const [mappingCount, stagedOk, correctionCount] = await Promise.all([
    db.columnMapping.count({ where: { organizationId: active.organization.id } }),
    db.stagedRecord.count({ where: { organizationId: active.organization.id, status: "ok" } }),
    db.correction.count({ where: { organizationId: active.organization.id } }),
  ]);
  const checklist: ChecklistState = {
    uploaded: runs.length > 0,
    mappingConfirmed: mappingCount > 0,
    answerReady: stagedOk > 0,
    correctionMade: correctionCount > 0,
  };
  const fleetSize = ((active.organization.settings ?? {}) as { fleetSize?: string }).fleetSize ?? "";

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <h1 className="text-xl font-bold">Upload — {active.organization.name}</h1>
      <FleetSizePicker initial={fleetSize} />
      <OnboardingChecklist state={checklist} />
      <DemoTour />
      <p className="text-sm text-gray-600">
        <Link href="/help" className="underline">How uploading works</Link>
      </p>
      <UploadForm />
      <p className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
        No file handy?
        <DemoSeedButton />
        <DemoSeedButton pack="reefer" label="Reefer sample" />
        <DemoSeedButton pack="flatbed" label="Flatbed sample" />
        <DemoSeedButton pack="dryvan" label="Dry-van sample" />
        <DemoResetButton slug={active.organization.slug} />
      </p>
      <GraduateButton />
      <section>
        <h2 className="font-medium">Import history</h2>
        {runs.length === 0 ? (
          <p className="mt-1 text-sm text-gray-600">No imports yet — upload above or try the sample week.</p>
        ) : (
        <div className="overflow-x-auto">
        <table className="mt-2 w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-1">File</th>
              <th>Type</th>
              <th>Status</th>
              <th>Rows ok / quarantined</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="py-1">
                  <Link href={`/imports/${r.id}`} className="underline">
                    {r.file.filename}
                  </Link>
                </td>
                <td>{r.sourceType}</td>
                <td>
                  {r.status} ({r.progress}%)
                </td>
                <td>
                  {r.okRows} / {r.quarantinedRows}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        )}
      </section>
    </main>
  );
}
