"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseQuery } from "@/lib/packs/freight/nl";
import { parseAgencyQuery } from "@/lib/packs/agency/nl";

export default function NlBox({
  week,
  pack = "freight",
}: {
  week: string;
  pack?: "freight" | "agency";
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const listPath = pack === "agency" ? "/answers/projects" : "/answers";
  const detailPath = pack === "agency" ? "/answers/project?project=" : "/answers/lane?lane=";

  function go(e: React.FormEvent) {
    e.preventDefault();
    const intent = pack === "agency" ? parseAgencyQuery(q) : parseQuery(q);
    const weekParam = intent.weekOffset === -1 ? shiftWeek(week, -1) : week;
    if (intent.view === "upload") router.push("/upload");
    else if (intent.view === "brief") router.push(`/briefs/${weekParam}`);
    else if (intent.view === "help") router.push("/help");
    else if (intent.view === "lane" && intent.lane) {
      router.push(`${detailPath}${encodeURIComponent(intent.lane)}&week=${weekParam}`);
    } else {
      const topic = intent.topic ? `&topic=${intent.topic}` : "";
      router.push(`${listPath}?week=${weekParam}${topic}`);
    }
  }

  const placeholder =
    pack === "agency"
      ? 'Ask: "which projects lost money last week?"'
      : 'Ask: "which lanes lost money last week?"';

  return (
    <form onSubmit={go} className="flex gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
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
