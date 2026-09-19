"use client";

import { useState } from "react";

interface SavedView {
  name: string;
  href: string;
}

const KEY = "saved-views";

function load(): SavedView[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as SavedView[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function SavedViews({ currentHref }: { currentHref: string }) {
  const [views, setViews] = useState<SavedView[]>(() => (typeof window === "undefined" ? [] : load()));
  const [name, setName] = useState("");

  function save() {
    const n = name.trim();
    if (!n) return;
    const next = [...views.filter((v) => v.name !== n), { name: n, href: currentHref }];
    setViews(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
    setName("");
  }

  function remove(n: string) {
    const next = views.filter((v) => v.name !== n);
    setViews(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name this view"
        aria-label="Name this view"
        className="rounded border p-1"
      />
      <button onClick={save} className="rounded border px-2 py-1">
        Save view
      </button>
      {views.map((v) => (
        <span key={v.name} className="flex items-center gap-1 rounded border px-2 py-1">
          <a href={v.href} className="underline">
            {v.name}
          </a>
          <button onClick={() => remove(v.name)} aria-label={`Remove ${v.name}`} className="text-gray-500">
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
