"use client";

import { useState } from "react";

interface EvalResult {
  question: string;
  ok: boolean;
  failures: string[];
  proposals: number;
  cited: number;
  steps: number;
}

// Live groundedness evals, run on demand against live data with the live
// provider. Labeled as regression gates: they assert every answer cites
// real context objects and proposes no ungrounded actions.
export default function EvalsPanel() {
  const [results, setResults] = useState<EvalResult[] | null>(null);
  const [score, setScore] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/agent/evals");
      const body = (await res.json()) as { score?: string; evals?: EvalResult[]; error?: string };
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "evals failed");
        return;
      }
      setScore(body.score ?? "");
      setResults(body.evals ?? []);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 className="font-medium ds-text">Groundedness evals (live provider)</h2>
      <p className="mt-1 text-sm ds-text-2">
        Regression gates, not judgments: scripted questions run against live data with the live AI, asserting
        every answer cites real objects and proposes nothing ungrounded. Needs an LLM key.
      </p>
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={() => void run()}
          disabled={busy}
          className="rounded px-3 py-1.5 text-sm text-[#141413] disabled:opacity-50"
          style={{ background: "var(--accent)" }}
        >
          {busy ? "Running…" : "Run evals"}
        </button>
        {score && <span className="text-sm ds-text-2">score {score}</span>}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
      {results && (
        <ul className="mt-2 divide-y rounded ds-panel" style={{ borderColor: "var(--hairline)" }}>
          {results.map((r) => (
            <li key={r.question} className="p-3 text-sm">
              <span className="font-medium ds-text">{r.question}</span>{" "}
              <span style={{ color: r.ok ? "var(--success)" : "var(--danger)" }}>{r.ok ? "pass" : "fail"}</span>
              <span className="block ds-text-2">
                {r.steps} steps, {r.cited} cited, {r.proposals} proposals
                {r.failures.length > 0 ? ` - ${r.failures.join("; ")}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
