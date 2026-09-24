"use client";

import { useEffect, useState } from "react";

interface KeyRow {
  provider: string;
  hint: string;
  updatedAt: string;
}

// Workspace AI key: owners paste a provider key once; automations use it
// instead of the server default. Stored encrypted, shown as a hint only.
export default function ProviderKeyForm() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [provider, setProvider] = useState("nvidia");
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function refresh() {
    try {
      const res = await fetch("/api/settings/provider-key");
      if (!res.ok) return;
      const body = (await res.json()) as { keys?: KeyRow[] };
      if (Array.isArray(body.keys)) setKeys(body.keys);
    } catch {
      /* panel stays empty */
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (raw.trim().length < 8) {
      setMsg("That key looks too short.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/settings/provider-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, key: raw }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        setRaw("");
        setMsg("Saved. Automations now use this key.");
        await refresh();
      } else {
        setMsg(body.error ?? "save failed");
      }
    } catch {
      setMsg("save failed");
    }
    setBusy(false);
  }

  async function remove(p: string) {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/settings/provider-key", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: p }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        setMsg("Removed. Automations fall back to the server key.");
        await refresh();
      } else {
        setMsg(body.error ?? "remove failed");
      }
    } catch {
      setMsg("remove failed");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      {keys.length > 0 ? (
        <ul className="divide-y rounded border text-sm" style={{ borderColor: "var(--hairline)" }}>
          {keys.map((k) => (
            <li key={k.provider} className="flex items-center justify-between gap-3 p-3">
              <span className="ds-text">
                <span className="font-medium capitalize">{k.provider}</span>{" "}
                <span className="ds-text-2">({k.hint || "saved"})</span>
              </span>
              <button
                type="button"
                onClick={() => void remove(k.provider)}
                disabled={busy}
                className="rounded border px-2 py-1 text-[13px] ds-text-2 disabled:opacity-50"
                style={{ borderColor: "var(--hairline)" }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm ds-text-2">No workspace key saved. Automations use the server key.</p>
      )}
      <form onSubmit={(e) => void save(e)} className="flex flex-wrap items-end gap-2">
        <label className="text-sm ds-text">
          Provider
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="ml-2 rounded border px-2 py-1.5 text-sm ds-text"
            style={{ borderColor: "var(--hairline)", background: "var(--panel)" }}
          >
            <option value="nvidia">NVIDIA</option>
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
          </select>
        </label>
        <label className="min-w-0 flex-1 text-sm ds-text">
          API key
          <input
            type="password"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="paste key"
            autoComplete="off"
            className="ml-2 w-full max-w-xs rounded border px-2 py-1.5 text-sm ds-text"
            style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
          />
        </label>
        <button
          type="submit"
          disabled={busy || raw.trim().length < 8}
          className="rounded px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: "var(--accent)" }}
        >
          {busy ? "Saving…" : "Save key"}
        </button>
      </form>
      {msg && (
        <p role="status" className="text-sm ds-text-2">
          {msg}
        </p>
      )}
    </div>
  );
}
