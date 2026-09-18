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

export default function Bell() {
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  async function load() {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const body = (await res.json()) as { items?: Item[]; unread?: number };
    setItems(body.items ?? []);
    setUnread(body.unread ?? 0);
  }

  useEffect(() => {
    void load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  async function markAll() {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setItems((xs) => xs.map((x) => ({ ...x, readAt: new Date().toISOString() })));
    setUnread(0);
  }

  return (
    <span className="relative text-sm">
      <button onClick={() => { setOpen((o) => !o); void load(); }} aria-label="Notifications">
        🔔{unread > 0 && <span className="ml-1 rounded bg-black px-1 text-xs text-white">{unread}</span>}
      </button>
      {open && (
        <span className="absolute right-0 z-10 block w-72 rounded border bg-white p-2 shadow">
          <span className="flex justify-between">
            <strong>Notifications</strong>
            <button onClick={markAll} className="underline">mark all read</button>
          </span>
          {items.length === 0 && <p className="mt-1 text-gray-500">Nothing yet.</p>}
          {items.slice(0, 10).map((i) => (
            <p key={i.id} className={i.readAt ? "text-gray-500" : "font-medium"}>
              {i.href ? <a href={i.href} className="underline">{i.title}</a> : i.title}
            </p>
          ))}
        </span>
      )}
    </span>
  );
}
