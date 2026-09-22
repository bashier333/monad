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
      <div className="rounded-2xl border p-6 ds-panel" style={{ borderColor: "var(--accent)" }} role="status">
        <p className="text-lg font-bold ds-text">Request received.</p>
        <p className="mt-1 text-[15px] ds-text-2">
          Builds go out in order. A human replies — never a drip campaign.
        </p>
      </div>
    );
  }

  const inputCls =
    "mt-1 w-full rounded-full border px-5 py-3 text-[15px] ds-text placeholder:opacity-60";
  const inputStyle = { borderColor: "var(--hairline)", background: "var(--ground)" } as const;

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="space-y-3 rounded-2xl border p-6 ds-panel"
      style={{ borderColor: "var(--hairline)" }}
    >
      <div>
        <label htmlFor="dl-email" className="text-sm font-semibold ds-text">
          Work email
        </label>
        <input
          id="dl-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
          style={inputStyle}
        />
      </div>
      <div>
        <label htmlFor="dl-use" className="text-sm font-semibold ds-text">
          What would you run first? <span className="font-normal ds-text-2">Optional</span>
        </label>
        <input
          id="dl-use"
          name="use"
          type="text"
          placeholder="Weekly margin review for my fleet"
          value={use}
          onChange={(e) => setUse(e.target.value)}
          className={inputCls}
          style={inputStyle}
        />
      </div>
      {state === "retry" && (
        <p role="status" className="text-sm ds-text-2">
          Saved on our side, but the mailer is offline. Your slot is held; try again later to confirm.
        </p>
      )}
      {state === "error" && (
        <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
          That did not go through. Check the email and try again.
        </p>
      )}
      <button
        type="submit"
        disabled={state === "sending"}
        className="cta-lift w-full rounded-full px-6 py-3 text-[15px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        style={{ background: "var(--accent)" }}
      >
        {state === "sending" ? "Sending…" : "Request access"}
      </button>
    </form>
  );
}
