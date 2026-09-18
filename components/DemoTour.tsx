"use client";

import { useState } from "react";

const STEPS = [
  "1. This is a sample week — real carrier shape, fake numbers.",
  "2. Open Answers: every lane's margin, worst first.",
  "3. Click a lane, expand a load: every dollar links to its source row.",
  "4. Flag anything you disagree with — corrections become rules.",
  "5. Upload your own export when ready. The sample wipes clean.",
];

export default function DemoTour() {
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem("demo-tour") === "1",
  );
  const [step, setStep] = useState(0);
  if (dismissed) return null;
  const done = () => {
    window.localStorage.setItem("demo-tour", "1");
    setDismissed(true);
  };
  return (
    <div className="rounded border border-blue-300 bg-blue-50 p-3 text-sm">
      <p>{STEPS[step]}</p>
      <div className="mt-2 flex gap-2">
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} className="rounded border px-2 py-1">
            Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep(step + 1)} className="rounded bg-black px-2 py-1 text-white">
            Next ({step + 1}/{STEPS.length})
          </button>
        ) : (
          <button onClick={done} className="rounded bg-black px-2 py-1 text-white">
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
