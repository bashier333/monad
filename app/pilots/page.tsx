import Link from "next/link";
import MeetingConfirm from "@/components/MeetingConfirm";
import PilotNotes from "@/components/PilotNotes";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";

function Criterion({ done, label, detail }: { done: boolean; label: string; detail: string }) {
  return (
    <div
      className="rounded border p-3 text-sm ds-panel"
      style={done ? { borderColor: "var(--success)" } : { borderColor: "var(--hairline)" }}
    >
      <p className="font-medium">
        {done ? "✓ " : "○ "} {label}
      </p>
      <p className="ds-text-2">{detail}</p>
    </div>
  );
}

export default async function PilotsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>
          <Link href="/signin" className="underline">
            Sign in
          </Link>{" "}
          for pilots.
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

  const checklist = await db.pilotChecklist.upsert({
    where: { organizationId: active.organization.id },
    update: {},
    create: { organizationId: active.organization.id },
  });
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [answerViews, corrections, rules] = await Promise.all([
    db.meterEvent.count({ where: { organizationId: active.organization.id, kind: "answer_view", createdAt: { gte: weekAgo } } }),
    db.correction.count({ where: { organizationId: active.organization.id } }),
    db.standingRule.count({ where: { organizationId: active.organization.id, active: true } }),
  ]);

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 md:p-8">
      <h1 className="text-xl font-bold">Pilot success for {active.organization.name}</h1>
      <p className="text-sm ds-text-2">
        Three criteria, written and tracked. Hit all three and this pilot converts.
      </p>
      <Criterion
        done={!!checklist.firstAnswerAt}
        label="First answer in under a day"
        detail={checklist.firstAnswerAt ? `Hit ${new Date(checklist.firstAnswerAt).toLocaleString()}` : "Upload an export to start the clock."}
      />
      <Criterion
        done={!!checklist.meetingConfirmedAt}
        label="Answer used in a real Monday meeting"
        detail={checklist.meetingConfirmedAt ? `Confirmed ${new Date(checklist.meetingConfirmedAt).toLocaleDateString()}` : "The retention hook. Nothing else counts."}
      />
      {!checklist.meetingConfirmedAt && <MeetingConfirm confirmedAt={null} />}
      <Criterion
        done={corrections > 0}
        label="At least one correction made"
        detail={corrections > 0 ? `${corrections} flags, ${rules} standing rules` : "Flag a figure from any lane."}
      />
      <section className="rounded border p-4 text-sm">
        <h2 className="font-medium">Kill-gate signals (live)</h2>
        <ul className="mt-1 list-disc pl-5">
          <li>Trail queries this week: {answerViews} (target: weekly use)</li>
          <li>
            Corrections → rules: {corrections === 0 ? "—" : `${Math.round((rules / corrections) * 10000) / 100}%`} (target: &gt;30%)
          </li>
          <li>Converted: {checklist.convertedAt ? new Date(checklist.convertedAt).toLocaleDateString() : "not yet"}</li>
        </ul>
        <p className="mt-2">
          <Link href="/settings" className="underline">
            Convert to Team →
          </Link>
        </p>
      </section>
      <section className="rounded border p-4">
        <PilotNotes initial={checklist.notes} />
      </section>
    </main>
  );
}
