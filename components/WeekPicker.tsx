"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

// Week stepper: ←/→ buttons + ArrowLeft/ArrowRight keys (when not typing) +
// Today + a native date picker snapped to the week. The URL is the source of
// truth — no localStorage hijack. Adjacent weeks prefetch on hover of intent.
export default function WeekPicker({ current }: { current: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function goTo(week: string) {
    const next = new URLSearchParams(params.toString());
    next.set("week", week);
    router.push(`?${next.toString()}`);
  }

  function shift(weeks: number) {
    const d = new Date(`${current}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + weeks * 7);
    goTo(d.toISOString().slice(0, 10));
  }

  function today() {
    const now = new Date();
    const iso = now.toISOString().slice(0, 10);
    goTo(iso);
  }

  function pickDate(iso: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    goTo(iso);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        shift(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        shift(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, params]);

  useEffect(() => {
    for (const w of [-1, 1]) {
      const d = new Date(`${current}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + w * 7);
      const next = new URLSearchParams(params.toString());
      next.set("week", d.toISOString().slice(0, 10));
      router.prefetch(`?${next.toString()}`);
    }
  }, [current, params, router]);

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <button
        type="button"
        onClick={() => shift(-1)}
        className="ds-state rounded border px-2 py-1 ds-text"
        style={{ borderColor: "var(--hairline)" }}
        aria-label="Previous week (Left arrow)"
      >
        ←
      </button>
      <span className="font-mono ds-text">week of {current}</span>
      <button
        type="button"
        onClick={() => shift(1)}
        className="ds-state rounded border px-2 py-1 ds-text"
        style={{ borderColor: "var(--hairline)" }}
        aria-label="Next week (Right arrow)"
      >
        →
      </button>
      <button
        type="button"
        onClick={today}
        className="ds-state rounded border px-2 py-1 ds-text-2"
        style={{ borderColor: "var(--hairline)" }}
      >
        Today
      </button>
      <label className="flex items-center gap-1 ds-text-2">
        <span className="sr-only">Jump to date</span>
        <input
          type="date"
          value={current}
          onChange={(e) => pickDate(e.target.value)}
          className="ds-state rounded border px-1 py-1 text-sm ds-text"
          style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
          aria-label="Jump to week of date"
        />
      </label>
    </div>
  );
}
