"use client";

import { useEffect, useState } from "react";

interface Status {
  status: string;
  progress: number;
  weekStart?: string;
}

export default function ImportProgress({ runId, week }: { runId: string; week: string }) {
  const [s, setS] = useState<Status | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t0 = Date.now();
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(`/api/imports/${runId}`);
        if (!res.ok) return;
        const body = (await res.json()) as { run?: Status };
        if (!alive || !body.run) return;
        setS(body.run);
        setElapsed(Math.round((Date.now() - t0) / 1000));
        if (body.run.status === "PENDING" || body.run.status === "PROCESSING") {
          setTimeout(tick, 2000);
        }
      } catch {
        /* retry next tick */
      }
    };
    void tick();
    return () => {
      alive = false;
    };
  }, [runId]);

  if (!s) return null;
  if (s.status !== "PENDING" && s.status !== "PROCESSING" && s.status !== "COMPLETED") return null;
  const eta = s.progress > 5 && s.progress < 100 ? ` (~${Math.max(1, Math.round((elapsed * (100 - s.progress)) / s.progress))}s left)` : "";
  return (
    <div className="rounded border p-3 text-sm" role="status">
      <p>
        {s.status} — {s.progress}%{eta}
      </p>
      <div className="mt-1 h-2 rounded bg-gray-200">
        <div className="h-2 rounded bg-black" style={{ width: `${Math.min(100, s.progress)}%` }} />
      </div>
      {s.status === "COMPLETED" && (
        <p className="mt-1">
          <a href={`/answers?week=${week}`} className="underline">
            View the answer →
          </a>
        </p>
      )}
    </div>
  );
}
