"use client";

import { useState } from "react";

export default function DownloadForm() {
  const [email, setEmail] = useState("");
  const [use, setUse] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "retry" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch("/api/download/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, use }),
      });
      if (!res.ok) {
        setState("error");
        return;
      }
      const body = (await res.json()) as { received: boolean; notified: boolean };
      setState(body.received && body.notified ? "done" : "retry");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-emerald-700 bg-emerald-700/10 p-6" role="status">
        <p className="text-lg font-bold">Request received.</p>
        <p className="mt-1 text-[15px] text-stone-600">
          Builds go out in order. A human replies from the founding inbox, never a drip campaign.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-stone-200 bg-white p-6">
      <div>
        <label htmlFor="dl-email" className="text-sm font-semibold">
          Work email
        </label>
        <input
          id="dl-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@shoplender.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-full border border-stone-300 bg-white px-5 py-3 text-[15px] text-stone-900 placeholder:text-stone-500"
        />
      </div>
      <div>
        <label htmlFor="dl-use" className="text-sm font-semibold">
          What would you run first? <span className="font-normal text-stone-500">Optional</span>
        </label>
        <input
          id="dl-use"
          name="use"
          type="text"
          placeholder="Nightly screen of new borrowers"
          value={use}
          onChange={(e) => setUse(e.target.value)}
          className="mt-1 w-full rounded-full border border-stone-300 bg-white px-5 py-3 text-[15px] text-stone-900 placeholder:text-stone-500"
        />
      </div>
      {state === "retry" && (
        <p role="status" className="text-sm text-stone-600">
          Saved on our side, but the mailer is offline. Your slot is held; try again later to confirm.
        </p>
      )}
      {state === "error" && (
        <p role="alert" className="text-sm text-red-700">
          That did not go through. Check the email and try again.
        </p>
      )}
      <button
        type="submit"
        disabled={state === "sending"}
        className="cta-lift w-full rounded-full bg-emerald-700 px-6 py-3 text-[15px] font-bold text-white hover:bg-emerald-800 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === "sending" ? "Sending…" : "Request Engine access"}
      </button>
    </form>
  );
}
