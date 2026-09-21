"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseQuery } from "@/lib/packs/freight/nl";
import { parseAgencyQuery } from "@/lib/packs/agency/nl";

// Natural-language jump box: label + example chips, inline result for
// unrecognized questions (role=alert, never a silent push), recent-query
// history for repeatability.
export default function NlBox({
  week,
  pack = "freight",
}: {
  week: string;
  pack?: "freight" | "agency";
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("monad-nl-history") ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const listPath = pack === "agency" ? "/answers/projects" : "/answers";
  const detailPath = pack === "agency" ? "/answers/project?project=" : "/answers/lane?lane=";

  function remember(query: string) {
    setHistory((h) => {
      const next = [query, ...h.filter((x) => x !== query)].slice(0, 5);
      try {
        localStorage.setItem("monad-nl-history", JSON.stringify(next));
      } catch {
        /* private mode */
      }
      return next;
    });
  }

  function go(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    const intent = pack === "agency" ? parseAgencyQuery(query) : parseQuery(query);
    // The parser returns a bare { view: "lanes" } with no topic/lane when
    // nothing matches: that is the unknown case, answered inline.
    const understood = intent.view !== "lanes" || intent.topic || intent.lane;
    if (!understood) {
      setError(`I couldn't parse that. Try “losers”, “detention”, a lane name, or “last week”.`);
      return;
    }
    setError("");
    remember(query);
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
    <div>
      <form onSubmit={go} className="flex gap-2">
        <label htmlFor="nl-ask" className="sr-only">
          Ask about this week in plain words
        </label>
        <input
          id="nl-ask"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="ds-control w-full rounded border p-2 text-sm ds-text"
          style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
        />
        <button
          type="submit"
          className="ds-control shrink-0 rounded px-4 py-2 text-sm font-medium"
          style={{ background: "var(--accent)", color: "#ffffff" }}
        >
          Ask
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-1 text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
      {history.length > 0 && (
        <p className="mt-1 flex flex-wrap gap-1 text-xs ds-text-2">
          Recent:
          {history.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setQ(h)}
              className="ds-state rounded border px-1.5 py-0.5"
              style={{ borderColor: "var(--hairline)" }}
            >
              {h}
            </button>
          ))}
        </p>
      )}
    </div>
  );
}

function shiftWeek(week: string, weeks: number): string {
  const d = new Date(`${week}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}
