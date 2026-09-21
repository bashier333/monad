"use client";

import { useRef, useState } from "react";

// Brief feedback: thumbs-up is one click; thumbs-down opens a note field
// (the API requires one line — it becomes a correction) with autofocus,
// keyboard-native buttons, and honest error text.
export default function BriefFeedback({ id, week }: { id: string; week: string }) {
  const [voted, setVoted] = useState(false);
  const [down, setDown] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const noteRef = useRef<HTMLInputElement | null>(null);

  async function vote(up: boolean) {
    if (!up && !down) {
      setDown(true);
      requestAnimationFrame(() => noteRef.current?.focus());
      return;
    }
    if (!up && note.trim() === "") {
      setMsg("Tell us what was wrong — one line is enough (it becomes a correction).");
      noteRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/briefs/${id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ up, note: note.trim(), week }),
      });
      if (res.ok) {
        setVoted(true);
      } else {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setMsg(body.error ?? "Vote failed — try again.");
      }
    } catch {
      setMsg("Vote failed — check your connection and try again.");
    }
    setBusy(false);
  }

  if (voted) return <p className="text-sm ds-text-2">Thanks — feedback recorded.</p>;
  return (
    <div className="text-sm">
      <div className="flex items-center gap-2">
        <span id="brief-feedback-q" className="ds-text">Was this brief right?</span>
        <button
          type="button"
          onClick={() => void vote(true)}
          disabled={busy}
          aria-describedby="brief-feedback-q"
          className="ds-control rounded border px-3 py-1 ds-text disabled:opacity-50"
          style={{ borderColor: "var(--hairline)" }}
        >
          <span aria-hidden>👍 </span>Yes
        </button>
        <button
          type="button"
          onClick={() => void vote(false)}
          disabled={busy}
          aria-expanded={down}
          aria-describedby="brief-feedback-q"
          className="ds-control rounded border px-3 py-1 ds-text disabled:opacity-50"
          style={{ borderColor: "var(--hairline)" }}
        >
          <span aria-hidden>👎 </span>No
        </button>
      </div>
      {down && (
        <div className="mt-2 flex gap-2">
          <label htmlFor="brief-note" className="sr-only">What was wrong (required)</label>
          <input
            id="brief-note"
            ref={noteRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What was wrong? (required)"
            className="ds-control w-full rounded border p-1 ds-text"
            style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
          />
          <button
            type="button"
            onClick={() => void vote(false)}
            disabled={busy}
            className="ds-control shrink-0 rounded px-3 py-1 font-medium disabled:opacity-50"
            style={{ background: "var(--accent)", color: "#ffffff" }}
          >
            Send
          </button>
        </div>
      )}
      {msg && (
        <p role="alert" className="mt-1" style={{ color: "var(--danger)" }}>
          {msg}
        </p>
      )}
    </div>
  );
}
