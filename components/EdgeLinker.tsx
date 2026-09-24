"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/primitives";

interface LinkDef {
  key: string;
  fromTypeKey: string;
  toTypeKey: string;
  cardinality: string;
}

// Edge linker: inside the explorer drawer, owners wire the picked object to
// another object over one of the type's links. Target is an object key;
// the server resolves and validates both ends.
export default function EdgeLinker({ fromId, fromTypeKey }: { fromId: string; fromTypeKey: string }) {
  const [links, setLinks] = useState<LinkDef[]>([]);
  const [linkKey, setLinkKey] = useState("");
  const [targetKey, setTargetKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/ontology/links")
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { links?: LinkDef[] } | null) => {
        const all = Array.isArray(b?.links) ? b.links : [];
        const mine = all.filter((l) => l.fromTypeKey === fromTypeKey);
        setLinks(mine);
        if (mine.length === 1 && mine[0]) setLinkKey(mine[0].key);
      })
      .catch(() => undefined);
  }, [fromTypeKey]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (busy || !linkKey || !targetKey.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      // Resolve the target key to an object id first (exact key wins).
      const want = targetKey.trim();
      const found = await fetch(`/api/ontology/search?q=${encodeURIComponent(want)}`).then((r) =>
        r.ok ? r.json() : null
      ) as { hits?: Array<{ id: string; key: string }> } | null;
      const hits = Array.isArray(found?.hits) ? found.hits : [];
      const target = hits.find((h) => h.key.toLowerCase() === want.toLowerCase()) ?? hits[0];
      if (!target) {
        setMsg({ ok: false, text: `No object with key “${want}”.` });
        setBusy(false);
        return;
      }
      const res = await fetch("/api/ontology/edges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromId, linkKey, toId: target.id }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        setMsg({ ok: true, text: `Linked over ${linkKey}. Reload the view to see it.` });
        setTargetKey("");
      } else {
        setMsg({ ok: false, text: body.error ?? "Could not create that link." });
      }
    } catch {
      setMsg({ ok: false, text: "Could not create that link. Check your connection and try again." });
    }
    setBusy(false);
  }

  if (links.length === 0) return null;

  return (
    <form onSubmit={(e) => void create(e)} className="mt-3 space-y-2 rounded-md border p-3" style={{ borderColor: "var(--hairline)" }}>
      <p className="text-sm font-medium ds-text">Link this object</p>
      <div className="flex flex-wrap gap-2">
        <select
          value={linkKey}
          onChange={(e) => setLinkKey(e.target.value)}
          aria-label="Link type"
          className="ds-control rounded-md border px-2 py-1.5 text-sm ds-text"
          style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
        >
          <option value="">Pick a link…</option>
          {links.map((l) => (
            <option key={l.key} value={l.key}>
              {l.key} → {l.toTypeKey}
            </option>
          ))}
        </select>
        <input
          value={targetKey}
          onChange={(e) => setTargetKey(e.target.value)}
          placeholder="target object key"
          autoComplete="off"
          aria-label="Target object key"
          className="ds-control min-w-36 flex-1 rounded-md border px-2 py-1.5 font-mono text-sm ds-text"
          style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
        />
        <Button type="submit" busy={busy} disabled={busy || !linkKey || targetKey.trim() === ""}>
          {busy ? "Linking…" : "Link"}
        </Button>
      </div>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className="text-sm ds-text-2">
          {msg.text}
        </p>
      )}
    </form>
  );
}
