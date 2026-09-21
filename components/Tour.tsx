"use client";

import { useCallback, useEffect, useState } from "react";

export interface TourStep {
  target?: string;
  title: string;
  body: string;
}

const STORAGE_KEY = "monad-tour-v1";

// Guided first-run tour: a highlight ring on the real UI plus a docked card,
// never a modal that blocks. Steps target [data-tour] elements; if a target
// is missing the step renders centered instead of failing. Progress persists
// in localStorage; Esc or Skip ends it. No animation (reduced-motion safe).
export default function Tour({ steps }: { steps: TourStep[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const close = useCallback((done: boolean) => {
    setIndex(null);
    setRect(null);
    if (done) {
      try {
        localStorage.setItem(STORAGE_KEY, "done");
      } catch {
        /* storage unavailable */
      }
    }
  }, []);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(STORAGE_KEY) === "done";
    } catch {
      dismissed = true;
    }
    if (!dismissed && steps.length > 0) setIndex(0);
    const replay = () => setIndex(0);
    window.addEventListener("monad:replay-tour", replay);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("monad:replay-tour", replay);
      window.removeEventListener("keydown", onKey);
    };
  }, [close, steps.length]);

  useEffect(() => {
    if (index === null) return;
    const step = steps[index];
    if (!step?.target) {
      setRect(null);
      return;
    }
    const update = () => {
      const el = document.querySelector(step.target!);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [index, steps]);

  if (index === null || !steps[index]) return null;
  const step = steps[index]!;
  const last = index === steps.length - 1;

  return (
    <div role="dialog" aria-label={`Tour: ${step.title}`} className="fixed inset-0 z-50">
      {rect && (
        <div
          aria-hidden
          className="absolute rounded-lg"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            border: "2px solid var(--accent)",
          }}
        />
      )}
      <div className="absolute inset-x-0 bottom-4 mx-auto w-[calc(100%-2rem)] max-w-md rounded-lg ds-panel p-4 shadow-xl">
        <p className="text-xs ds-text-2" aria-live="polite">
          Step {index + 1} of {steps.length}
        </p>
        <p className="mt-1 font-medium ds-text">{step.title}</p>
        <p className="mt-1 text-sm ds-text-2">{step.body}</p>
        <div className="mt-3 flex items-center gap-2">
          {index > 0 && (
            <button type="button" onClick={() => setIndex(index - 1)} className="ds-state rounded border px-3 py-1.5 text-sm ds-text" style={{ borderColor: "var(--hairline)" }}>
              Back
            </button>
          )}
          {!last ? (
            <button
              type="button"
              onClick={() => setIndex(index + 1)}
              className="rounded px-3 py-1.5 text-sm font-medium"
              style={{ background: "var(--accent)", color: "#141413" }}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={() => close(true)}
              className="rounded px-3 py-1.5 text-sm font-medium"
              style={{ background: "var(--accent)", color: "#141413" }}
            >
              Done
            </button>
          )}
          <button type="button" onClick={() => close(true)} className="ml-auto text-sm underline ds-text-2">
            Skip tour
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReplayTourButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("monad:replay-tour"))}
      className="ds-state rounded border px-3 py-1.5 text-sm ds-text"
      style={{ borderColor: "var(--hairline)" }}
    >
      Take the tour
    </button>
  );
}
