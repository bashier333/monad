"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/primitives";

// Confirm: modal for destructive or irreversible actions. Cancel is focused
// by default (safe choice first); Esc closes. Never use for reversible,
// re-creatable things — a plain Button suffices there.
// Lives here (not primitives) because it uses hooks: primitives must stay
// server-safe so server pages can render Empty, Stat, and Section.
export function Confirm({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }} onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="ds-overlay w-full max-w-sm space-y-3 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-semibold ds-text">{title}</p>
        <p className="text-sm ds-text-2">{body}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} ref={cancelRef}>
            Cancel
          </Button>
          <Button variant="danger" busy={busy} disabled={busy} onClick={onConfirm}>
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
