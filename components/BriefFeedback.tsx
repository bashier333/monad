"use client";

import { useState } from "react";

export default function BriefFeedback({ id, week }: { id: string; week: string }) {
  const [voted, setVoted] = useState(false);
  const [down, setDown] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");

  async function vote(up: boolean) {
    if (!up && !down) {
      setDown(true);
      return;
    }
    if (!up && note.trim() === "") {
      setMsg("Tell us what was wrong — one line is enough.");
      return;
    }
    const res = await fetch(`/api/briefs/${id}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ up, note: note.trim(), week }),
    });
    if (res.ok) {
      setVoted(true);
    } else {
      setMsg("Vote failed.");
    }
  }

  if (voted) return <p className="text-sm text-green-700">Thanks — feedback recorded.</p>;
  return (
    <div className="text-sm">
      <div className="flex items-center gap-2">
        <span>Was this brief right?</span>
        <button onClick={() => vote(true)} className="rounded border px-2 py-1">
          👍 Yes
        </button>
        <button onClick={() => vote(false)} className="rounded border px-2 py-1">
          👎 No
        </button>
      </div>
      {down && (
        <div className="mt-2 flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What was wrong? (required)"
            className="w-full rounded border p-1"
          />
          <button onClick={() => vote(false)} className="rounded bg-black px-3 py-1 text-white">
            Send
          </button>
        </div>
      )}
      {msg && <p className="mt-1 text-red-600">{msg}</p>}
    </div>
  );
}
