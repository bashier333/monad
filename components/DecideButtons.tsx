"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Decide buttons: no full-page reload (router.refresh keeps scroll and
// filter context), local terminal state, honest failure text.
export default function DecideButtons({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "working" | "failed" | "applied" | "rejected" | "reverted">("idle");

  async function post(body: Record<string, unknown>, done: "applied" | "rejected" | "reverted") {
    setState("working");
    try {
      const res = await fetch(`/api/corrections/${id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setState(done);
        router.refresh();
      } else {
        setState("failed");
      }
    } catch {
      setState("failed");
    }
  }

  // Boolean flags (not direct comparisons) so TypeScript's narrowing can't
  // strand the async "working" state as unreachable in later branches.
  const working = state === "working";
  const reverted = state === "reverted";
  const rejected = state === "rejected";
  const appliedNow = state === "applied";
  if (working) return <span className="text-xs ds-text-2">…</span>;
  if (reverted) {
    return <span className="text-xs ds-text-2">Reverted — re-run the week to apply.</span>;
  }
  if (rejected) return <span className="text-xs ds-text-2">Rejected.</span>;

  if (appliedNow || (state === "idle" && status === "applied")) {
    return (
      <span className="flex items-center gap-2">
        {appliedNow && <span className="text-xs ds-text-2">Applied — re-run the week to see it.</span>}
        <button
          onClick={() => void post({ revert: true }, "reverted")}
          className="ds-state rounded border px-2 py-1 text-xs ds-text"
          style={{ borderColor: "var(--hairline)" }}
        >
          Undo
        </button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <button
        onClick={() => void post({ approve: true }, "applied")}
        disabled={working}
        className="rounded px-2 py-1 text-xs font-medium text-[#141413] disabled:opacity-50"
        style={{ background: "var(--accent)" }}
      >
        Apply
      </button>
      <button
        onClick={() => void post({ approve: false }, "rejected")}
        disabled={working}
        className="ds-state rounded border px-2 py-1 text-xs ds-text disabled:opacity-50"
        style={{ borderColor: "var(--hairline)" }}
      >
        Reject
      </button>
      {working && <span className="text-xs ds-text-2">…</span>}
      {state === "failed" && (
        <span role="alert" className="text-xs" style={{ color: "var(--danger)" }}>
          failed — try again
        </span>
      )}
    </span>
  );
}
