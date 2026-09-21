"use client";

import { useState } from "react";
import { trackFunnel } from "@/lib/analytics";

// Clipboard actions for a brief: copy the link (for the Monday meeting
// chat) or the TL;DR text. No backend needed — the URL carries the week.
export default function BriefCopyButtons({ summary }: { summary: string }) {
  const [msg, setMsg] = useState("");

  async function copy(text: string, kind: "link" | "summary") {
    try {
      await navigator.clipboard.writeText(text);
      setMsg(kind === "link" ? "Link copied." : "Summary copied.");
    } catch {
      setMsg("Copy failed — select and copy manually.");
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-sm">
      <button
        type="button"
        onClick={() => {
          trackFunnel("brief_opened_in_meeting", { via: "copy_link" });
          void copy(window.location.href, "link");
        }}
        className="ds-state rounded border px-2 py-1 ds-text"
        style={{ borderColor: "var(--hairline)" }}
      >
        Copy link
      </button>
      <button
        type="button"
        onClick={() => void copy(summary, "summary")}
        className="ds-state rounded border px-2 py-1 ds-text"
        style={{ borderColor: "var(--hairline)" }}
      >
        Copy summary
      </button>
      {msg && (
        <span role="status" className="ds-text-2">
          {msg}
        </span>
      )}
    </span>
  );
}
