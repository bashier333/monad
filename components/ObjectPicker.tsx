"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface PickedObject {
  id: string;
  key: string;
  typeKey: string;
}

interface Hit {
  id: string;
  typeKey: string;
  key: string;
  score: number;
  matched?: "key" | "text" | "fuzzy";
}

const MATCH_LABEL: Record<string, string> = { key: "key", text: "details", fuzzy: "fuzzy" };

// Shared object search-picker: type to search, arrows + Enter to pick.
// Discipline: 250ms debounce, min 2 chars, abort superseded requests, render
// only the newest response (sequence guard) — debounce alone leaves the
// stale-win bug. Replaces pasting raw UUIDs across runner/explorer/console.
export default function ObjectPicker({
  onPick,
  picked,
  typeFilter,
  placeholder = "Search objects by key…",
}: {
  onPick: (o: PickedObject | null) => void;
  picked?: PickedObject | null;
  typeFilter?: string;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);
  const listId = useId();
  const inputId = useId();

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setHits([]);
      setActive(-1);
      setSearching(false);
      return;
    }
    setSearching(true);
    const mySeq = ++seq.current;
    const controller = new AbortController();
    timer.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: q.trim() });
        if (typeFilter) params.set("type", typeFilter);
        const res = await fetch(`/api/ontology/search?${params.toString()}`, { signal: controller.signal });
        if (!res.ok || seq.current !== mySeq) return;
        const body = (await res.json()) as { hits: Hit[] };
        if (seq.current !== mySeq) return;
        setHits(body.hits.slice(0, 8));
        setActive(-1);
        setOpen(true);
      } catch {
        /* aborted or failed: keep previous hits */
      } finally {
        if (seq.current === mySeq) setSearching(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer.current!);
      controller.abort();
    };
  }, [q, typeFilter]);

  function choose(h: Hit) {
    onPick({ id: h.id, key: h.key, typeKey: h.typeKey });
    setOpen(false);
    setQ("");
    setHits([]);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" && open && hits.length > 0) {
      e.preventDefault();
      setActive((a) => (a + 1) % hits.length);
    } else if (e.key === "ArrowUp" && open && hits.length > 0) {
      e.preventDefault();
      setActive((a) => (a - 1 + hits.length) % hits.length);
    } else if (e.key === "Enter" && open && active >= 0 && hits[active]) {
      e.preventDefault();
      choose(hits[active]!);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  }

  if (picked) {
    return (
      <span className="flex items-center gap-2 rounded px-3 py-2 text-sm ds-panel">
        <span className="font-medium ds-text">{picked.key}</span>
        <span className="font-mono text-xs ds-text-2">{picked.typeKey}</span>
        <button type="button" onClick={() => { onPick(null); setQ(""); }} className="ml-auto underline ds-text-2" aria-label="Clear selection">
          clear
        </button>
      </span>
    );
  }

  return (
    <span className="relative block">
      <input
        id={inputId}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => { if (hits.length > 0) setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={searching ? "Searching…" : placeholder}
        role="combobox"
        aria-expanded={open && hits.length > 0}
        aria-controls={listId}
        aria-activedescendant={active >= 0 && hits[active] ? `${listId}-${hits[active]!.id}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        className="w-full rounded border px-3 py-2 text-sm ds-text"
        style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
      />
      {open && hits.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded ds-panel">
          {hits.map((h, i) => (
            <li key={h.id} role="option" id={`${listId}-${h.id}`} aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(h)}
                onMouseMove={() => setActive(i)}
                className="ds-state block w-full px-3 py-2 text-left text-sm"
                style={i === active ? { background: "color-mix(in srgb, var(--fg) 8%, transparent)" } : undefined}
              >
                <span className="font-medium ds-text">{h.key}</span>{" "}
                <span className="font-mono text-xs ds-text-2">{h.typeKey}</span>{" "}
                <span className="text-xs ds-text-2">· {MATCH_LABEL[h.matched ?? "text"] ?? "details"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
