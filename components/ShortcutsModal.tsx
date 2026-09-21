"use client";

import { useEffect } from "react";

// Keyboard shortcut reference (? opens it). Lists only implemented
// shortcuts — nothing aspirational.
const SHORTCUTS: Array<{ keys: string; what: string }> = [
  { keys: "Ctrl/⌘ + K", what: "Open the command palette from anywhere" },
  { keys: "/", what: "Focus the Ask / search input" },
  { keys: "← / →", what: "Step the answers week back / forward" },
  { keys: "A / R", what: "Approve / reject the focused inbox card" },
  { keys: "Esc", what: "Close dialogs and the palette" },
  { keys: "?", what: "Open this reference" },
];

export function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose ]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[18%]"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded p-4 ds-panel"
        style={{ borderColor: "var(--hairline)", background: "var(--panel)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-medium ds-text">Keyboard shortcuts</h2>
        <ul className="mt-2 space-y-1.5 text-sm">
          {SHORTCUTS.map((s) => (
            <li key={s.keys} className="flex items-center justify-between gap-3">
              <span className="ds-text-2">{s.what}</span>
              <kbd
                className="whitespace-nowrap rounded border px-1.5 py-0.5 font-mono text-xs ds-text"
                style={{ borderColor: "var(--hairline)" }}
              >
                {s.keys}
              </kbd>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onClose}
          autoFocus
          className="mt-3 rounded border px-3 py-1.5 text-sm ds-text"
          style={{ borderColor: "var(--hairline)" }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
