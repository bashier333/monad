"use client";

import { useState } from "react";

export default function SessionsButton() {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  async function load() {
    const res = await fetch("/api/auth/sessions");
    if (!res.ok) return;
    const body = (await res.json()) as { sessions?: unknown[] };
    setCount(body.sessions?.length ?? 0);
  }

  async function logoutAll() {
    if (!window.confirm("Sign out everywhere, including this device?")) return;
    setBusy(true);
    const res = await fetch("/api/auth/sessions", { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      const body = (await res.json()) as { revoked?: number };
      setMsg(`Signed out ${body.revoked ?? 0} session(s). This page will refresh.`);
      setTimeout(() => window.location.reload(), 1500);
    } else {
      setMsg("failed");
    }
  }

  return (
    <span className="text-sm">
      <button onClick={() => void load()} className="underline">
        Sessions{count !== null ? ` (${count})` : ""}
      </button>{" "}
      <button onClick={() => void logoutAll()} disabled={busy} className="rounded border px-2 py-1 disabled:opacity-50">
        {busy ? "…" : "Sign out everywhere"}
      </button>
      {msg && <span className="ml-2 ds-text-2">{msg}</span>}
    </span>
  );
}
