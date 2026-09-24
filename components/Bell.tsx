"use client";

import { useEffect, useState } from "react";

interface Item {
  id: string;
  kind: string;
  title: string;
  href: string;
  readAt: string | null;
  createdAt: string;
}

// Notifications bell: themed via warm-ink vars (legible in both themes),
// live-region announcement for new arrivals, Escape to close.
export default function Bell() {
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  async function load() {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const body = (await res.json()) as { items?: Item[]; unread?: number };
      setItems(body.items ?? []);
      setUnread(body.unread ?? 0);
    } catch {
      /* notifications unavailable: bell stays quiet, never breaks nav */
    }
  }

  useEffect(() => {
    void load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open ]);

  async function markAll() {
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) return;
    } catch {
      return;
    }
    setItems((xs) => xs.map((x) => ({ ...x, readAt: new Date().toISOString() })));
    setUnread(0);
  }

  return (
    <span className="relative text-sm">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); void load(); }}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className="ds-state rounded px-1.5 py-1 ds-text"
      >
        <span aria-hidden>🔔</span>
        {unread > 0 && (
          <span
            className="ml-1 rounded px-1 text-xs font-medium"
            style={{ background: "var(--accent)", color: "#ffffff" }}
          >
            {unread}
          </span>
        )}
      </button>
      {open && (
        <span
          className="absolute right-0 z-10 block w-72 rounded p-2 shadow ds-panel"
          style={{ borderColor: "var(--hairline)", background: "var(--panel)" }}
          role="region"
          aria-label="Notifications"
        >
          <span className="flex items-center justify-between">
            <strong className="ds-text">Notifications</strong>
            <button type="button" onClick={() => void markAll()} className="underline ds-text-2">
              mark all read
            </button>
          </span>
          <span aria-live="polite">
            {items.length === 0 && <p className="mt-1 ds-text-2">Nothing yet.</p>}
            {items.slice(0, 10).map((i) => (
              <p key={i.id} className={i.readAt ? "ds-text-2" : "font-medium ds-text"}>
                {i.href ? <a href={i.href} className="underline">{i.title}</a> : i.title}
              </p>
            ))}
          </span>
        </span>
      )}
    </span>
  );
}
