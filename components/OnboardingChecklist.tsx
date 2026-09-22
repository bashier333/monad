import Link from "next/link";

export interface ChecklistState {
  uploaded: boolean;
  mappingConfirmed: boolean;
  answerReady: boolean;
  correctionMade: boolean;
}

const FREIGHT_STEPS: Array<{ key: keyof ChecklistState; label: string; href: string }> = [
  { key: "uploaded", label: "Upload an export", href: "/upload" },
  { key: "mappingConfirmed", label: "Confirm the column mapping", href: "/upload" },
  { key: "answerReady", label: "See your first lane-margin answer", href: "/answers" },
  { key: "correctionMade", label: "Flag or correct one figure", href: "/answers" },
];

const AGENCY_STEPS: Array<{ key: keyof ChecklistState; label: string; href: string }> = [
  { key: "uploaded", label: "Upload an export", href: "/upload" },
  { key: "mappingConfirmed", label: "Confirm the column mapping", href: "/upload" },
  { key: "answerReady", label: "See your first project-margin answer", href: "/answers/projects" },
  { key: "correctionMade", label: "Flag or correct one figure", href: "/answers/projects" },
];

export default function OnboardingChecklist({
  state,
  pack = "freight",
}: {
  state: ChecklistState;
  pack?: "freight" | "agency";
}) {
  const STEPS = pack === "agency" ? AGENCY_STEPS : FREIGHT_STEPS;
  const done = STEPS.filter((s) => state[s.key]).length;
  if (done === STEPS.length) return null;
  return (
    <section className="rounded border p-4 text-sm ds-panel" style={{ borderColor: "var(--info)" }}>
      <h2 className="font-medium">
        Getting started ({done}/{STEPS.length})
      </h2>
      <ol className="mt-1 list-decimal pl-5">
        {STEPS.map((s) => (
          <li key={s.key} className={state[s.key] ? "text-green-700 line-through" : ""}>
            {state[s.key] ? s.label : <Link href={s.href} className="underline">{s.label}</Link>}
          </li>
        ))}
      </ol>
    </section>
  );
}
