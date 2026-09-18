"use client";

import { useState } from "react";

export default function ShareButton({ week, pack = "freight" }: { week: string; pack?: "freight" | "agency" }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function share() {
    setBusy(true);
    const res = await fetch("/api/answers/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ week, pack }),
    });
    setBusy(false);
    if (res.ok) {
      const body = (await res.json()) as { url: string };
      setUrl(body.url);
    }
  }

  if (url) {
    return (
      <p className="text-sm">
        Share link (30 days):{" "}
        <a href={url} className="break-all underline">
          {url}
        </a>
      </p>
    );
  }
  return (
    <button onClick={share} disabled={busy} className="rounded border px-3 py-1 text-sm disabled:opacity-50">
      {busy ? "Creating…" : "Share this week"}
    </button>
  );
}
