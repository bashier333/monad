"use client";

import { useState } from "react";
import { trackFunnel } from "@/lib/analytics";

// Share controls: create link, one-click copy, visible expiry, owner revoke.
// TTL is fixed at 30 days by the API (no picker — the backend accepts none);
// revoke needs the billing role and reports honestly when it doesn't apply.
export default function ShareButton({ week, pack = "freight" }: { week: string; pack?: "freight" | "agency" }) {
  const [url, setUrl] = useState("");
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [revoked, setRevoked] = useState(false);

  async function share() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/answers/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week, pack }),
      });
      if (res.ok) {
        const body = (await res.json()) as { url: string; expiresAt?: string };
        setUrl(`${body.url}?utm_source=share`);
        setExpires(body.expiresAt ? new Date(body.expiresAt).toLocaleDateString() : "in 30 days");
        trackFunnel("share_created", { week, pack });
      } else {
        setMsg("Share failed — try again.");
      }
    } catch {
      setMsg("Share failed — check your connection and try again.");
    }
    setBusy(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMsg("Copied.");
    } catch {
      setMsg("Copy failed — select the link manually.");
    }
  }

  async function revoke() {
    const token = url.split("/s/")[1]?.split("?")[0];
    if (!token) return;
    setBusy(true);
    try {
      const res = await fetch("/api/answers/share", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        setRevoked(true);
        setMsg("Revoked — the link no longer works.");
      } else if (res.status === 403) {
        setMsg("Only owners can revoke links.");
      } else {
        setMsg("Revoke failed — try again.");
      }
    } catch {
      setMsg("Revoke failed — check your connection and try again.");
    }
    setBusy(false);
  }

  if (url && !revoked) {
    return (
      <div className="text-sm">
        <p className="ds-text-2">Share link (expires {expires}):</p>
        <p className="mt-1 flex flex-wrap items-center gap-2">
          <a href={url} className="break-all underline ds-text">
            {url}
          </a>
          <button
            type="button"
            onClick={() => void copy()}
            className="ds-state shrink-0 rounded border px-2 py-1 ds-text"
            style={{ borderColor: "var(--hairline)" }}
          >
            Copy
          </button>
          <button
            type="button"
            onClick={() => void revoke()}
            disabled={busy}
            className="ds-state shrink-0 rounded border px-2 py-1 ds-text disabled:opacity-50"
            style={{ borderColor: "var(--hairline)" }}
          >
            Revoke
          </button>
        </p>
        {msg && (
          <p className="mt-1 ds-text-2" role="status">
            {msg}
          </p>
        )}
      </div>
    );
  }

  return (
    <span className="text-sm">
      <button
        onClick={() => void share()}
        disabled={busy}
        className="ds-state rounded border px-3 py-1 ds-text disabled:opacity-50"
        style={{ borderColor: "var(--hairline)" }}
      >
        {busy ? "Creating…" : "Share this week"}
      </button>
      {msg && (
        <span className="ml-2 ds-text-2" role="status">
          {msg}
        </span>
      )}
      {revoked && <span className="ml-2 ds-text-2">Link revoked.</span>}
    </span>
  );
}
