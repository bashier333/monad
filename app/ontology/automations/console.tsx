"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PhaseTimeline, type OodaPhase, type PhaseState } from "@/components/primitives";
import { stableKey } from "@/lib/idempotency";

interface Proposal {
  verb: string;
  objectId: string;
  objectKey: string;
  inputs: Record<string, unknown>;
  preview: unknown;
  approvalRequired: boolean;
  allowedRoles?: string[];
  latitude?: string;
}

interface RunRecord {
  question: string;
  answer: string;
  proposals: Proposal[];
  provider: string;
  at: string;
  // Absent on pre-timing records still sitting in localStorage.
  seconds?: number;
}

interface FeedItem {
  type: string;
  text: string;
  tool?: string;
  at: number;
}

// Wide verbs (no undo, cross-object blast radius) require typing the target
// key before Confirm & execute — same bar as the actions runner.
const WIDE_VERBS = new Set(["mfg_reroute_shipment"]);

type ProposalState =
  | { state: "idle" }
  | { state: "confirming" }
  | { state: "needs_approval"; approvalId?: string; note: string }
  | { state: "executed"; message: string };

async function postJson(url: string, body: unknown, signal?: AbortSignal) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  const parsed = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { res, body: parsed };
}

// Renders agent answers with clickable [id] citations into the explorer.
function CitedAnswer({ text }: { text: string }) {
  const parts = text.split(/(\[[a-zA-Z0-9_-]+\])/g);
  return (
    <pre className="whitespace-pre-wrap rounded ds-panel-2 p-3 text-sm ds-text">
      {parts.map((p, i) => {
        const m = /^\[([a-zA-Z0-9_-]+)\]$/.exec(p);
        if (!m) return <span key={i}>{p}</span>;
        return (
          <Link
            key={i}
            href={`/ontology/explore?id=${encodeURIComponent(m[1]!)}`}
            className="font-medium underline"
            style={{ color: "var(--accent)" }}
          >
            {p}
          </Link>
        );
      })}
    </pre>
  );
}

function loadHistory(): RunRecord[] {
  try {
    return JSON.parse(localStorage.getItem("agent-history") ?? "[]") as RunRecord[];
  } catch {
    return [];
  }
}

// Tool → OODA phase mapping, stated once and shared: queries observe,
// deterministic logic orients, action proposals decide, human-confirmed
// execution acts. Assigned by tool name from the runtime — never guessed
// from summary text.
function phaseForTool(tool: string | undefined, type: string): OodaPhase | null {
  if (tool === "ontology_query") return "observe";
  if (tool === "ontology_logic") return "orient";
  if (tool === "ontology_action") return "decide";
  if (type === "text") return "orient";
  return null;
}

function derivePhases(
  feed: Array<{ type: string; text: string; tool?: string }>,
  proposals: Proposal[],
  proposalStates: Record<number, ProposalState>,
  running: boolean
): Array<{ phase: OodaPhase; state: PhaseState; detail?: string }> {
  const seen = new Map<OodaPhase, number>();
  for (const f of feed) {
    const p = phaseForTool(f.tool, f.type);
    if (p && !seen.has(p)) seen.set(p, feed.indexOf(f) + 1);
  }
  const order: OodaPhase[] = ["observe", "orient", "decide", "act"];
  const executed = Object.values(proposalStates).filter((s) => s.state === "executed").length;
  return order.map((phase) => {
    let state: PhaseState = "pending";
    let detail: string | undefined;
    if (phase === "act") {
      if (executed > 0) {
        state = "succeeded";
        detail = `${executed} executed`;
      } else if (proposals.length > 0) {
        state = "paused";
        detail = "awaiting human confirmation";
      }
    } else if (seen.has(phase)) {
      state = "succeeded";
      detail = `step ${seen.get(phase)}`;
    }
    if (running && state === "pending") {
      const lastPhase = [...seen.keys()].pop();
      if (phase === lastPhase) state = "running";
    }
    return { phase, state, detail };
  });
}

export default function AgentConsole() {
  const [question, setQuestion] = useState("which orders are at risk of missing SLA?");
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [answer, setAnswer] = useState("");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [provider, setProvider] = useState("");
  const [backend, setBackend] = useState<{ checked: boolean; configured: boolean; provider: string | null; source: string | null; available: Array<{ provider: string; source: string }>; hint: string }>({
    checked: false,
    configured: false,
    provider: null,
    source: null,
    available: [],
    hint: "",
  });
  const [wantedProvider, setWantedProvider] = useState("auto");
  const [running, setRunning] = useState(false);
  const [proposalStates, setProposalStates] = useState<Record<number, ProposalState>>({});
  const [wideText, setWideText] = useState<Record<number, string>>({});
  const [history, setHistory] = useState<RunRecord[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const aborter = useRef<AbortController | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    fetch("/api/agent/run")
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { configured?: boolean; provider?: string | null; source?: string | null; available?: Array<{ provider: string; source: string }>; hint?: string } | null) => {
        if (!b) return;
        setBackend({
          checked: true,
          configured: b.configured === true,
          provider: typeof b.provider === "string" ? b.provider : null,
          source: typeof b.source === "string" ? b.source : null,
          available: Array.isArray(b.available) ? b.available : [],
          hint: typeof b.hint === "string" ? b.hint : "",
        });
      })
      .catch(() => undefined);
  }, []);

  // Live elapsed timer while a run is in flight. DeepSeek reasons at length
  // before answering (often a minute or more per step), so the UI must show
  // time passing — silence reads as broken.
  useEffect(() => {
    if (!running) return;
    setElapsed(0);
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [running]);

  function saveRun(rec: RunRecord) {
    setHistory((h) => {
      const next = [rec, ...h].slice(0, 10);
      try {
        localStorage.setItem("agent-history", JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (running) return;
    setRunning(true);
    setFeed([]);
    setAnswer("");
    setProposals([]);
    setProvider("");
    setProposalStates({});
    const started = Date.now();
    const push = (type: string, text: string, tool?: string) =>
      setFeed((f) => [...f, { type, text, tool, at: Date.now() }]);
    const controller = new AbortController();
    aborter.current = controller;
    let finalAnswer = "";
    let finalProposals: Proposal[] = [];
    let finalProvider = "";
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, ...(wantedProvider !== "auto" ? { provider: wantedProvider } : {}) }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        // Surface the server's message (e.g. missing AI key), not just the
        // status: "run failed: 503" tells nobody what to do.
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        push("error", body && typeof body.error === "string" ? `run failed: ${body.error}` : `run failed: ${res.status}`);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim().replace(/^data:\s*/, "");
          if (!line) continue;
          const event = JSON.parse(line) as { type: string; step?: number; text?: string; tool?: string; answer?: string; proposals?: Proposal[]; provider?: string; error?: string };
          if (event.type === "done") {
            finalAnswer = event.answer ?? "";
            finalProposals = event.proposals ?? [];
            finalProvider = event.provider ?? "";
            setAnswer(finalAnswer);
            setProposals(finalProposals);
            setProvider(finalProvider);
          } else if (event.type === "error") {
            push("error", event.error ?? "error");
          } else {
            push(event.type, event.text ?? "", event.tool);
          }
        }
      }
      if (finalAnswer) {
        saveRun({
          question,
          answer: finalAnswer,
          proposals: finalProposals,
          provider: finalProvider,
          at: new Date().toISOString(),
          seconds: Math.round((Date.now() - started) / 1000),
        });
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        push("cancelled", "run cancelled by user");
      }
    } finally {
      setRunning(false);
      aborter.current = null;
    }
  }

  function cancel() {
    aborter.current?.abort();
  }

  function pushFeed(type: string, text: string) {
    setFeed((f) => [...f, { type, text, at: Date.now() }]);
  }

  function restore(rec: RunRecord) {
    setQuestion(rec.question);
    setAnswer(rec.answer);
    setProposals(rec.proposals);
    setProvider(rec.provider);
    setProposalStates({});
    setFeed([]);
  }

  function setProposal(i: number, s: ProposalState) {
    setProposalStates((prev) => ({ ...prev, [i]: s }));
  }

  async function confirm(i: number, proposal: Proposal, approvalId?: string) {
    setProposal(i, { state: "confirming" });
    const { res, body } = await postJson("/api/agent/confirm", {
      actionKey: proposal.verb,
      objectId: proposal.objectId,
      inputs: proposal.inputs,
      // Stable key: confirming twice replays the receipt, never duplicates.
      idempotencyKey: stableKey(proposal.verb, proposal.objectId, approvalId, proposal.inputs),
      approve: true,
      ...(approvalId ? { approvalId } : {}),
    });
    const error = typeof body.error === "string" ? body.error : "confirm failed";
    const needsApproval = res.status === 409 || body.needsApproval === true;
    if (!res.ok && needsApproval) {
      const returnedId = typeof body.approvalId === "string" ? body.approvalId : approvalId;
      if (!returnedId) {
        const req = await postJson("/api/ontology/approvals", {
          actionKey: proposal.verb,
          objectId: proposal.objectId,
          inputs: proposal.inputs,
        });
        const approval = (req.body.approval as { id?: string } | undefined)?.id;
        if (!req.res.ok || !approval) {
          setProposal(i, { state: "idle" });
          pushFeed("error", typeof req.body.error === "string" ? req.body.error : "approval request failed");
          return;
        }
        setProposal(i, { state: "needs_approval", approvalId: approval, note: `Approval ${approval} requested.` });
        return;
      }
      setProposal(i, { state: "needs_approval", approvalId: returnedId, note: error });
      return;
    }
    if (!res.ok) {
      setProposal(i, { state: "idle" });
      pushFeed("error", error);
      return;
    }
    const runId = typeof body.runId === "string" ? body.runId : "unknown";
    setProposal(i, { state: "executed", message: `run ${runId}${body.replayed === true ? " (replayed)" : ""}` });
  }

  async function approve(i: number, approvalId: string, proposal: Proposal) {
    setProposal(i, { state: "confirming" });
    const { res, body } = await postJson("/api/ontology/approvals", { id: approvalId, approve: true, comment: "approved from automation console" });
    if (!res.ok) {
      setProposal(i, { state: "needs_approval", approvalId, note: typeof body.error === "string" ? body.error : "approval failed" });
      return;
    }
    await confirm(i, proposal, approvalId);
  }

  return (
    <section className="space-y-3 rounded border p-4">
      <h2 className="font-medium">Ask the model</h2>
      {backend.checked &&
        (backend.configured ? (
          <p className="text-xs ds-text-2">AI backend ready{backend.provider ? ` (${backend.provider}${backend.source === "org" ? ", workspace key" : ""})` : ""}.</p>
        ) : (
          <p role="alert" className="rounded border p-2 text-xs" style={{ borderColor: "var(--warn)" }}>
            AI is not connected yet{backend.hint ? `: ${backend.hint}` : ""}. Add the key to the server environment, then ask away.
          </p>
        ))}
      <p className="text-sm ds-text-2">
        Ask in plain English. For example, “which shipments are late?” The model reads your live data,
        shows each step below, and only proposes actions. Nothing runs until you confirm it. Answers
        typically take a minute or two while the model reasons; you can cancel anytime.
      </p>
      <form onSubmit={(e) => void run(e)} className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="which orders are at risk of missing SLA?"
          className="w-full rounded border px-3 py-2 text-sm"
        />
        {backend.available.length > 1 && (
          <select
            value={wantedProvider}
            onChange={(e) => setWantedProvider(e.target.value)}
            aria-label="AI provider"
            className="rounded border px-2 py-2 text-sm ds-text"
            style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
          >
            <option value="auto">Auto</option>
            {backend.available.map((a) => (
              <option key={a.provider} value={a.provider}>
                {a.provider}
                {a.source === "org" ? " (key)" : ""}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          disabled={running}
          className="whitespace-nowrap rounded px-4 py-2 text-sm text-white disabled:opacity-50"
          style={{ background: "var(--accent)" }}
        >
          {running ? "Running…" : "Run"}
        </button>
        {running && (
          <>
            <button type="button" onClick={cancel} className="whitespace-nowrap rounded border px-4 py-2 text-sm">
              Cancel
            </button>
            <span className="self-center whitespace-nowrap text-sm ds-text-2" role="status">
              thinking… {elapsed}s
            </span>
          </>
        )}
      </form>
      {(feed.length > 0 || running) && (
        <PhaseTimeline
          phases={derivePhases(feed, proposals, proposalStates, running)}
          note="Observe: object reads · Orient: deterministic logic · Decide: proposed actions · Act: human-confirmed writes."
        />
      )}
      {feed.length > 0 && (
        <ul className="space-y-1 text-sm ds-text-2">
          {feed.map((f, i) => (
            <li key={i}>
              <span className="font-mono text-xs ds-text-2">+{Math.round((f.at - feed[0]!.at) / 1000)}s</span>{" "}
              <span className="font-medium">{f.type}</span>: {f.text}
            </li>
          ))}
        </ul>
      )}
      {answer && (
        <div className="space-y-3">
          <CitedAnswer text={answer} />
          {provider && <p className="text-xs ds-text-2">answered by: {provider}</p>}
          {proposals.map((p, i) => {
            const st = proposalStates[i] ?? { state: "idle" as const };
            const wide = WIDE_VERBS.has(p.verb);
            const wideTarget = p.objectKey || p.objectId;
            const wideReady = !wide || (wideText[i] ?? "").trim() === wideTarget.trim();
            const previewEntries =
              p.preview !== null && p.preview !== undefined && typeof p.preview === "object" && !Array.isArray(p.preview)
                ? Object.entries(p.preview as Record<string, unknown>).slice(0, 8)
                : null;
            return (
              <div key={i} className="rounded border p-3 text-sm ds-panel" style={{ borderColor: "var(--hairline)" }}>
                <p className="ds-text">
                  <span className="font-medium">{p.verb}</span> on {p.objectKey || p.objectId}
                  {p.approvalRequired ? " (approval required)" : ""}
                </p>
                {(p.latitude || (p.allowedRoles && p.allowedRoles.length > 0)) && (
                  <p className="mt-1 text-xs ds-text-2">
                    latitude: {p.latitude ?? "confirm"}
                    {p.allowedRoles && p.allowedRoles.length > 0 ? ` - roles: ${p.allowedRoles.join(", ")}` : ""}
                  </p>
                )}
                <pre className="mt-1 whitespace-pre-wrap rounded ds-panel-2 p-2 font-mono text-xs ds-text">{JSON.stringify(p.inputs, null, 1)}</pre>
                {previewEntries ? (
                  <dl className="mt-1 grid grid-cols-1 gap-0.5 rounded ds-panel-2 p-2 text-xs">
                    {previewEntries.map(([k, v]) => (
                      <div key={k} className="flex gap-1">
                        <dt className="ds-text-2">{k}:</dt>
                        <dd className="font-mono ds-text">{JSON.stringify(v)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  p.preview !== null && p.preview !== undefined && (
                    <p className="mt-1 rounded ds-panel-2 p-2 font-mono text-xs ds-text">
                      preview: {JSON.stringify(p.preview).slice(0, 500)}
                    </p>
                  )
                )}
                {wide && st.state !== "executed" && (
                  <p className="mt-2 text-xs ds-text-2">
                    Wide blast radius, no undo. Type the target key (“{wideTarget}”) to unlock Confirm.
                    <input
                      value={wideText[i] ?? ""}
                      onChange={(e) => setWideText((w) => ({ ...w, [i]: e.target.value }))}
                      placeholder={wideTarget}
                      aria-label="Type the target key to confirm"
                      className="ml-2 rounded border px-2 py-1 font-mono text-xs ds-text"
                      style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
                    />
                  </p>
                )}
                <div className="mt-2 flex gap-2">
                  {st.state === "executed" ? (
                    <span className="ds-text-2">{st.message}</span>
                  ) : st.state === "needs_approval" ? (
                    <>
                      <span className="ds-text-2">{st.note}</span>
                      {st.approvalId && (
                        <button
                          onClick={() => void approve(i, st.approvalId!, p)}
                          disabled={!wideReady}
                          className="ds-state rounded border px-3 py-1.5 ds-text disabled:opacity-50"
                          style={{ borderColor: "var(--hairline)" }}
                        >
                          Approve
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => void confirm(i, p)}
                      disabled={st.state === "confirming" || !wideReady}
                      className="rounded px-3 py-1.5 text-white disabled:opacity-50"
                      style={{ background: "var(--accent)" }}
                    >
                      {st.state === "confirming" ? "Confirming…" : "Confirm & execute"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {history.length > 0 && (
        <div className="text-sm">
          <h3 className="font-medium">Recent runs ({history.length})</h3>
          <ul className="mt-1 divide-y rounded border" style={{ borderColor: "var(--hairline)" }}>
            {history.map((h, i) => (
              <li key={i}>
                <button onClick={() => restore(h)} className="ds-state block w-full px-3 py-2 text-left">
                  <span className="font-medium ds-text">{h.question}</span>{" "}
                  <span className="ds-text-2">
                    {h.proposals.length} proposal{h.proposals.length === 1 ? "" : "s"} · {h.seconds ?? "?"}s · {h.provider || "unknown"} · {h.at.slice(0, 16).replace("T", " ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
