"use client";

import Link from "next/link";

export default function OntologyError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-8">
      <h1 className="text-xl font-bold ds-text">Something broke in Studio</h1>
      <p className="rounded p-4 text-sm ds-panel" style={{ color: "var(--danger)" }}>{error.message || "Unknown error"}</p>
      <div className="flex gap-3 text-sm">
        <button
          onClick={reset}
          className="rounded px-4 py-2 text-[#141413]"
          style={{ background: "var(--accent)" }}
        >
          Try again
        </button>
        <Link href="/ontology" className="rounded border px-4 py-2 ds-text" style={{ borderColor: "var(--hairline)" }}>
          Back to Studio
        </Link>
      </div>
    </main>
  );
}
