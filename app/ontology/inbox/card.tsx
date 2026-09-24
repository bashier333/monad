"use client";

import Link from "next/link";
import { useState } from "react";
import { Confirm } from "@/components/Confirm";

export interface ApprovalItem {
  id: string;
  actionKey: string;
  objectId: string;
  inputs: Record<string, unknown> | null;
  requestedById: string;
  approvals: unknown;
  requiredCount: number;
  createdAt: string;
}

function ageOf(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m old`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h old`;
  return `${Math.floor(hours / 24)}d old`;
}

// Approval card: inputs preview, requester, age, quorum progress, comment,
// A/R keys while the card is focused (never while typing). Deciding hides
// the card optimistically — approvals have no un-decide, so no undo is
// offered and none is implied.
export default function ApprovalCard({ approval }: { approval: ApprovalItem }) {
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "working" | "failed" | "done">("idle");
  const [done, setDone] = useState("");

  const votes = Array.isArray(approval.approvals) ? approval.approvals : [];
  const yesVotes = votes.filter((v) => v && typeof v === "object" && (v as { approve?: boolean }).approve !== false).length;
  const quorum = Math.min(yesVotes, approval.requiredCount);
  const inputs = approval.inputs ?? {};

  const [failReason, setFailReason] = useState<string | null>(null);
  const [confirmReject, setConfirmReject] = useState(false);

  async function decide(approve: boolean) {
    if (state === "working" || state === "done") return;
    setState("working");
    setFailReason(null);
    try {
      const res = await fetch("/api/ontology/approvals", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: approval.id, approve, comment }),
      });
      if (res.ok) {
        const body = (await res.json()) as { approval?: { status?: string } };
        setDone(String(body.approval?.status ?? (approve ? "approved" : "rejected")));
        setState("done");
      } else if (res.status === 403) {
        setFailReason("OWNER role required.");
        setState("failed");
      } else {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setFailReason(body.error ?? "Request failed. Try again.");
        setState("failed");
      }
    } catch {
      setFailReason("Request failed. Check your connection and try again.");
      setState("failed");
    }
  }

  if (state === "done") {
    return (
      <li className="p-3 text-sm ds-text-2" role="status">
        {approval.actionKey} on {approval.objectId.slice(0, 8)}… · {done}.
      </li>
    );
  }

  return (
    <li
      className="rounded p-3 text-sm ds-panel"
      style={{ borderColor: "var(--hairline)" }}
      tabIndex={0}
      aria-label={`Approval: ${approval.actionKey}. Press A to approve, R to reject.`}
      onKeyDown={(e) => {
        const target = e.target as HTMLElement | null;
        const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");
        if (typing) return;
        if (e.key === "a" || e.key === "A") void decide(true);
        if (e.key === "r" || e.key === "R") setConfirmReject(true);
      }}
    >
      <p>
        <span className="font-medium ds-text">{approval.actionKey}</span> <span className="ds-text-2">on</span>{" "}
        <Link href={`/ontology/explore?id=${encodeURIComponent(approval.objectId)}`} className="font-mono text-xs underline ds-text">
          {approval.objectId.slice(0, 12)}…
        </Link>{" "}
        <span className="ds-text-2">
          · requested by {approval.requestedById.slice(0, 8)}… · {ageOf(approval.createdAt)}
        </span>
      </p>
      {Object.keys(inputs).length > 0 && (
        <p className="mt-1 font-mono text-xs ds-text-2">
          {Object.entries(inputs)
            .slice(0, 6)
            .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
            .join(" · ")}
        </p>
      )}
      <p className="mt-1 text-xs ds-text-2" aria-label={`Quorum ${quorum} of ${approval.requiredCount}`}>
        quorum {quorum}/{approval.requiredCount}{" "}
        <span aria-hidden style={{ color: "var(--accent)" }}>{"■".repeat(quorum)}</span>
        <span aria-hidden className="ds-text-2">{"□".repeat(Math.max(0, approval.requiredCount - quorum))}</span>
      </p>
      <span className="mt-2 flex flex-wrap items-center gap-2">
        <label htmlFor={`comment-${approval.id}`} className="sr-only">Comment (required to reject)</label>
        <input
          id={`comment-${approval.id}`}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="comment (required to reject)"
          className="ds-control min-w-48 flex-1 rounded border px-2 py-1 text-xs ds-text"
          style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
        />
        <button
          type="button"
          onClick={() => void decide(true)}
          disabled={state === "working"}
          title="Approve (A)"
          className="ds-control rounded px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
          style={{ background: "var(--accent)" }}
        >
          Approve (A)
        </button>
        <button
          type="button"
          onClick={() => setConfirmReject(true)}
          disabled={state === "working"}
          title="Reject (R)"
          className="ds-control rounded border px-2 py-1 text-xs ds-text disabled:opacity-50"
          style={{ borderColor: "var(--hairline)" }}
        >
          Reject (R)
        </button>
        <Confirm
          open={confirmReject}
          title="Reject this approval?"
          body="The requester is told it was rejected. Rejections cannot be undone from here."
          confirmLabel="Reject"
          busy={state === "working"}
          onCancel={() => setConfirmReject(false)}
          onConfirm={() => {
            setConfirmReject(false);
            void decide(false);
          }}
        />
        {state === "working" && <span className="text-xs ds-text-2">…</span>}
        {state === "failed" && (
          <span role="alert" className="text-xs" style={{ color: "var(--danger)" }}>
            {failReason ?? "Request failed. Try again."}
          </span>
        )}
      </span>
    </li>
  );
}
