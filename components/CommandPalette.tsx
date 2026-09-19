"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const ACTIONS = [
  { name: "Go: dashboard", href: "/dashboard", keys: ["dashboard", "home"] },
  { name: "Go: fleet answers", href: "/answers", keys: ["fleet", "lanes", "answers"] },
  { name: "Go: studio answers", href: "/answers/projects", keys: ["studio", "projects"] },
  { name: "Go: upload", href: "/upload", keys: ["upload", "import", "file"] },
  { name: "Go: corrections queue", href: "/corrections", keys: ["corrections", "flags", "queue"] },
  { name: "Go: standing rules", href: "/rules", keys: ["rules"] },
  { name: "Go: briefs", href: "/briefs", keys: ["briefs", "report"] },
  { name: "Go: search", href: "/search", keys: ["search", "find"] },
  { name: "Go: packs", href: "/packs", keys: ["packs", "market"] },
  { name: "Go: activity", href: "/activity", keys: ["activity", "audit", "log"] },
  { name: "Go: settings", href: "/settings", keys: ["settings", "billing"] },
  { name: "Go: help", href: "/help", keys: ["help", "docs"] },
  { name: "Action: re-run this week (agency)", href: "/answers/projects", keys: ["rerun", "recompute"] },
];

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !typing && !open) {
        const box = document.querySelector<HTMLInputElement>('input[aria-label="Ask"], input[placeholder*="Ask"]');
        if (box) {
          e.preventDefault();
          box.focus();
        }
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open ]);

  const query = q.trim().toLowerCase();
  const matches = ACTIONS.filter(
    (a) => !query || a.name.toLowerCase().includes(query) || a.keys.some((k) => k.includes(query)),
  );

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/30 p-4" onClick={() => setOpen(false)}>
      <div className="mx-auto mt-20 max-w-md rounded bg-white p-3 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type a command… (Esc closes)"
          aria-label="Command palette"
          className="w-full rounded border p-2 text-sm"
        />
        <ul className="mt-2 max-h-64 overflow-auto text-sm">
          {matches.map((a) => (
            <li key={a.name}>
              <button
                className="w-full rounded px-2 py-1 text-left hover:bg-gray-100"
                onClick={() => {
                  setOpen(false);
                  router.push(a.href);
                }}
              >
                {a.name}
              </button>
            </li>
          ))}
          {matches.length === 0 && <li className="px-2 py-1 text-gray-500">No matches.</li>}
        </ul>
      </div>
    </div>
  );
}
