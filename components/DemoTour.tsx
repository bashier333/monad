"use client";

import { useState } from "react";

const FREIGHT_STEPS = [
  "1. This is a sample week — real carrier shape, fake numbers.",
  "2. Open Answers: every lane's margin, worst first.",
  "3. Click a lane, expand a load: every dollar links to its source row.",
  "4. Flag anything you disagree with — corrections become rules.",
  "5. Upload your own export when ready. The sample wipes clean.",
];

const AGENCY_STEPS = [
  "1. This is a sample week — real studio shape, fake numbers.",
  "2. Open Project margins: every project's margin, worst first.",
  "3. Click a project, expand a revision: every dollar links to its source row.",
  "4. Flag anything you disagree with — corrections become rules.",
  "5. Upload your own export when ready. The sample wipes clean.",
];

export default function DemoTour({ pack = "freight" }: { pack?: "freight" | "agency" }) {
  const STEPS = pack === "agency" ? AGENCY_STEPS : FREIGHT_STEPS;
  const storeKey = pack === "agency" ? "demo-tour-agency" : "demo-tour";
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(storeKey) === "1",
  );
  const [step, setStep] = useState(0);
  if (dismissed) return null;
  const done = () => {
    window.localStorage.setItem(storeKey, "1");
    setDismissed(true);
  };
  return (
    <div className="rounded border p-3 text-sm ds-panel" style={{ borderColor: "var(--info)" }}>
      <p>{STEPS[step]}</p>
      <div className="mt-2 flex gap-2">
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} className="rounded border px-2 py-1">
            Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep(step + 1)} className="rounded-md font-medium px-2 py-1 text-white" style={{ background: "var(--accent)" }}>
            Next ({step + 1}/{STEPS.length})
          </button>
        ) : (
          <button onClick={done} className="rounded-md font-medium px-2 py-1 text-white" style={{ background: "var(--accent)" }}>
            Got it
          </button>
        )}
        <button onClick={done} className="underline">
          Skip
        </button>
      </div>
    </div>
  );
}
