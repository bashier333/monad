"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function WeekPicker({ current, ns = "last-week" }: { current: string; ns?: string }) {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(ns);
      if (!params.get("week") && stored && stored !== current) {
        const next = new URLSearchParams(params.toString());
        next.set("week", stored);
        router.replace(`?${next.toString()}`);
        return;
      }
      window.localStorage.setItem(ns, current);
    } catch {
      /* private mode */
    }
  }, [current, params, router, ns]);

  function shift(weeks: number) {
    const d = new Date(`${current}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + weeks * 7);
    const next = new URLSearchParams(params.toString());
    next.set("week", d.toISOString().slice(0, 10));
    router.push(`?${next.toString()}`);
  }

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
    <div className="flex items-center gap-2 text-sm">
      <button onClick={() => shift(-1)} className="rounded border px-2 py-1" aria-label="Previous week">
        ←
      </button>
      <span className="font-mono">week of {current}</span>
      <button onClick={() => shift(1)} className="rounded border px-2 py-1" aria-label="Next week">
        →
      </button>
    </div>
  );
}
