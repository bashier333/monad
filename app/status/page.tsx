"use client";

import { useEffect, useState } from "react";

export default function StatusPage() {
  const [health, setHealth] = useState<{ ok?: boolean; time?: string } | null>(null);

  useEffect(() => {
    void fetch("/api/health")
      .then((r) => r.json())
      .then((b: { ok?: boolean; time?: string }) => setHealth(b))
      .catch(() => setHealth({}));
  }, []);

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-8 text-sm">
      <h1 className="text-xl font-bold">Status</h1>
      <p>
        {health === null
          ? "Checking…"
          : health.ok
            ? "All systems operational."
            : "Degraded — see known issues or contact support."}
      </p>
      <p className="text-gray-500">Checked {health?.time ? new Date(health.time).toLocaleString() : "—"}</p>
      <p>
        <a href="/known-issues" className="underline">Known issues</a> ·{" "}
        <a href="/changelog" className="underline">Changelog</a> ·{" "}
        <a href="/support" className="underline">Support</a>
      </p>
    </main>
  );
}
