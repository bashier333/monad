"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseQuery } from "@/lib/packs/freight/nl";

export default function NlBox({ week }: { week: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  function go(e: React.FormEvent) {
    e.preventDefault();
    const intent = parseQuery(q);
    const weekParam = intent.weekOffset === -1 ? shiftWeek(week, -1) : week;
    if (intent.view === "upload") router.push("/upload");
    else if (intent.view === "brief") router.push(`/briefs/${weekParam}`);
    else if (intent.view === "help") router.push("/help");
    else if (intent.view === "lane" && intent.lane) {
      router.push(`/answers/lane?lane=${encodeURIComponent(intent.lane)}&week=${weekParam}`);
    } else {
      const topic = intent.topic ? `&topic=${intent.topic}` : "";
      router.push(`/answers?week=${weekParam}${topic}`);
    }
  }

  return (
    <form onSubmit={go} className="flex gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder='Ask: "which lanes lost money last week?"'
        className="w-full rounded border p-2 text-sm"
      />
      <button type="submit" className="rounded bg-black px-4 py-2 text-sm text-white">
        Ask
      </button>
    </form>
  );
}

function shiftWeek(week: string, weeks: number): string {
  const d = new Date(`${week}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}
