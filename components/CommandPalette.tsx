"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import SpringIn from "@/components/motion";
import { getDesktopMode } from "@/components/desktop-flag";

interface Entry {
  id: string;
  title: string;
  layer: "Understand" | "Do" | "Decide" | "System";
  keywords: string[];
  href?: string;
  run?: () => void;
  shortcut?: string;
  desktop: boolean;
}

interface ObjectHit {
  id: string;
  key: string;
  typeKey: string;
}

// Navigation entries grouped by the Understand / Do / Decide layers.
// desktop:false entries (legacy freight surfaces) are hidden inside the exe,
// where they would render with no chrome.
const ENTRIES: Entry[] = [
  { id: "go-workspace", title: "Go: workspace", layer: "Understand", keywords: ["workspace", "home"], href: "/workspace", desktop: true },
  { id: "go-board", title: "Go: operations board", layer: "Understand", keywords: ["board", "operations", "company", "overview", "map"], href: "/ontology/board", desktop: true },
  { id: "go-twin", title: "Go: digital twin", layer: "Understand", keywords: ["twin", "manufacturing", "coverage", "risk"], href: "/ontology/twin", desktop: true },
  { id: "go-explore", title: "Go: explore objects", layer: "Understand", keywords: ["explore", "search", "graph", "find"], href: "/ontology/explore", desktop: true },
  { id: "go-schema", title: "Go: ontology schema", layer: "Understand", keywords: ["schema", "types", "links", "studio"], href: "/ontology", desktop: true },
  { id: "go-actions", title: "Go: actions", layer: "Do", keywords: ["actions", "execute", "write"], href: "/ontology/actions", desktop: true },
  { id: "go-inbox", title: "Go: approvals inbox", layer: "Do", keywords: ["inbox", "approvals", "confirm", "decide"], href: "/ontology/inbox", desktop: true },
  { id: "go-automations", title: "Go: automations", layer: "Decide", keywords: ["automations", "agent", "console"], href: "/ontology/automations", desktop: true },
  { id: "go-scenarios", title: "Go: scenarios", layer: "Decide", keywords: ["scenarios", "branches", "whatif"], href: "/ontology/scenarios", desktop: true },
  { id: "go-audit", title: "Go: audit trail", layer: "Decide", keywords: ["audit", "lineage", "events", "verify"], href: "/ontology/audit", desktop: true },
  { id: "go-ops", title: "Go: ops (policies, playbooks, alerts)", layer: "Decide", keywords: ["ops", "policies", "playbooks", "alerts"], href: "/ontology/ops", desktop: true },
  { id: "go-answers", title: "Go: fleet answers", layer: "System", keywords: ["fleet", "lanes", "answers"], href: "/answers", desktop: false },
  { id: "go-upload", title: "Go: upload", layer: "System", keywords: ["upload", "import", "file"], href: "/upload", desktop: false },
  { id: "go-corrections", title: "Go: corrections queue", layer: "System", keywords: ["corrections", "flags", "queue"], href: "/corrections", desktop: false },
  { id: "go-rules", title: "Go: standing rules", layer: "System", keywords: ["rules"], href: "/rules", desktop: false },
  { id: "go-briefs", title: "Go: briefs", layer: "System", keywords: ["briefs", "report"], href: "/briefs", desktop: false },
  { id: "go-search", title: "Go: search", layer: "System", keywords: ["search", "find"], href: "/search", desktop: false },
  { id: "go-packs", title: "Go: packs", layer: "System", keywords: ["packs", "market"], href: "/packs", desktop: false },
  { id: "go-activity", title: "Go: activity", layer: "System", keywords: ["activity", "audit", "log"], href: "/activity", desktop: false },
  { id: "go-settings", title: "Go: settings", layer: "System", keywords: ["settings", "billing"], href: "/settings", desktop: false },
  { id: "go-help", title: "Go: help", layer: "System", keywords: ["help", "docs"], href: "/help", desktop: false },
];

const LAYER_ORDER = ["Understand", "Do", "Decide", "System"] as const;

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [desktop, setDesktop] = useState(false);
  const [hits, setHits] = useState<ObjectHit[]>([]);
  const [hitsLoading, setHitsLoading] = useState(false);
  const invoker = useRef<HTMLElement | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    let live = true;
    void getDesktopMode().then((d) => {
      if (live) setDesktop(d);
    });
    return () => {
      live = false;
    };
  }, []);

  // External open (the visible ⌘K button in TopNav): records the invoker
  // so focus returns on close, same as the keyboard toggle.
  useEffect(() => {
    const onOpen = () => {
      const active = document.activeElement;
      invoker.current = active instanceof HTMLElement ? active : null;
      setOpen(true);
    };
    window.addEventListener("monad:open-palette", onOpen);
    return () => window.removeEventListener("monad:open-palette", onOpen);
  }, []);

  // Global toggle (+ "/" focuses the Ask input). Return focus to the invoker
  // on close so keyboard users never lose their place.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!open) invoker.current = target instanceof HTMLElement ? target : null;
        setOpen((o) => !o);
      } else if (e.key === "/" && !typing && !open) {
        const box = document.querySelector<HTMLInputElement>('input[aria-label="Ask"], input[placeholder*="Ask"]');
        if (box) {
          e.preventDefault();
          box.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open ]);

  // Live object search (debounced, aborted, capped): the palette's nested
  // "object → actions" discovery without a second page.
  useEffect(() => {
    if (!open) return;
    const query = q.trim();
    if (query.length < 2) {
      setHits([]);
      setHitsLoading(false);
      return;
    }
    setHitsLoading(true);
    const t = setTimeout(async () => {
      abort.current?.abort();
      const c = new AbortController();
      abort.current = c;
      try {
        const res = await fetch(`/api/ontology/search?q=${encodeURIComponent(query)}`, { signal: c.signal });
        if (!res.ok) return;
        const body = (await res.json()) as { hits?: ObjectHit[] };
        if (!c.signal.aborted) setHits((body.hits ?? []).slice(0, 8));
      } catch {
        /* aborted or failed: keep previous hits */
      } finally {
        if (!c.signal.aborted) setHitsLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, open ]);

  function close(restoreFocus = true) {
    setOpen(false);
    setQ("");
    if (restoreFocus) invoker.current?.focus?.();
  }

  function go(href: string) {
    close(false);
    router.push(href);
  }

  // Dark-only product: no theme toggle exists. Density lives in TopNav.

  const visible = ENTRIES.filter((e) => !desktop || e.desktop);
  const commands: Entry[] = [...visible];

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close())}
      label="Command palette"
      className="ds-panel fixed left-1/2 top-[18%] z-50 w-full max-w-md -translate-x-1/2 rounded-lg p-2 shadow-xl"
      overlayClassName="fixed inset-0 z-50 bg-black/30"
    >
      <SpringIn scaleFrom={0.98} y={-6}>
      <Command.Input
        value={q}
        onValueChange={setQ}
        placeholder="Type a command or search objects…"
        aria-label="Command palette"
        className="w-full rounded border-0 bg-transparent px-2 py-2 text-sm outline-none ds-text"
      />
      <Command.List className="mt-1 max-h-72 overflow-auto text-sm">
        <Command.Empty className="px-2 py-3 ds-text-2">
          {hitsLoading ? "Searching objects…" : q.trim() ? `No match for “${q.trim()}”. Try fewer words, or pick a module below.` : "Type to search commands and objects."}
        </Command.Empty>
        {hits.length > 0 && (
          <Command.Group heading="Objects">
            {hits.map((h) => (
              <Command.Item
                key={h.id}
                value={`${h.key} ${h.typeKey}`}
                onSelect={() => go(`/ontology/explore?id=${encodeURIComponent(h.id)}`)}
                className="ds-state flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 aria-selected:font-medium"
              >
                <span className="ds-text">{h.key}</span>
                <span className="font-mono text-xs ds-text-2">{h.typeKey}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
        {LAYER_ORDER.map((layer) => {
          const items = commands.filter((c) => c.layer === layer && (!desktop || c.desktop || layer === "System"));
          const shown = layer === "System" && desktop ? items.filter((c) => c.run) : items;
          if (shown.length === 0) return null;
          return (
            <Command.Group key={layer} heading={layer}>
              {shown.map((c) => (
                <Command.Item
                  key={c.id}
                  value={[c.title, ...c.keywords].join(" ")}
                  keywords={c.keywords}
                  onSelect={() => (c.run ? c.run() : c.href ? go(c.href) : undefined)}
                  className="ds-state flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 aria-selected:font-medium"
                >
                  <span className="ds-text">{c.title}</span>
                  {c.shortcut ? <kbd className="rounded border px-1 font-mono text-xs ds-text-2">{c.shortcut}</kbd> : null}
                </Command.Item>
              ))}
            </Command.Group>
          );
        })}
      </Command.List>
      <div className="flex gap-3 border-t px-2 pt-2 text-xs ds-text-2" style={{ borderColor: "var(--hairline)" }}>
        <span><kbd>↑↓</kbd> navigate</span>
        <span><kbd>⏎</kbd> open</span>
        <span><kbd>esc</kbd> close</span>
      </div>
      </SpringIn>
    </Command.Dialog>
  );
}
