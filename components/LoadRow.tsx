"use client";

import Link from "next/link";
import { useState } from "react";
import type { LoadMargin } from "@/lib/packs/freight/margin/engine";
import FlagDialog from "@/components/FlagDialog";

export interface FigureHistory {
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
  status: string;
  createdAt: string;
}

export default function LoadRow({ load, history, expandAll = false }: { load: LoadMargin; history: FigureHistory[]; expandAll?: boolean }) {
  const [open, setOpen] = useState(false);
  const expanded = open || expandAll;
  return (
    <>
      <tr className="border-t" style={{ borderColor: "var(--hairline)" }}>
        <td className="py-1 font-mono ds-text">{load.loadKey}</td>
        <td className="ds-text-2">{load.date}</td>
        <td className="ds-text-2">{load.driver}</td>
        <td className="ds-text-2">{load.truck}</td>
        <td className="ds-text-2">{load.broker || "—"}</td>
        <td className="text-right tabular-nums ds-text">${load.revenue.toFixed(2)}</td>
        <td className="text-right tabular-nums ds-text">${load.totalCost.toFixed(2)}</td>
        <td
          className="text-right font-medium tabular-nums"
          style={{ color: load.margin < 0 ? "var(--danger)" : "var(--success)" }}
          aria-label={`margin ${load.margin < 0 ? "loss" : "profit"} $${load.margin.toFixed(2)}`}
        >
          <span aria-hidden>{load.margin < 0 ? "▼ " : "▲ "}</span>${load.margin.toFixed(2)}
        </td>
        <td>
          <button
            onClick={() => setOpen((o) => !o)}
            className="underline ds-text-2"
            aria-expanded={expanded}
            aria-label={`cost lines for ${load.loadKey}`}
          >
            {expanded ? "hide" : `${load.costs.length} lines`}
          </button>
        </td>
      </tr>
      {expanded &&
        load.costs.map((c, i) => (
          <tr key={i} className="border-t text-xs ds-panel-2" style={{ borderColor: "var(--hairline)" }}>
            <td />
            <td colSpan={3} className="ds-text-2">
              {c.label}{" "}
              <Link href="/rules" className="underline" title="Open standing rules">
                ({c.ruleId})
              </Link>
            </td>
            <td colSpan={2} className="text-right tabular-nums ds-text">
              ${c.amount.toFixed(2)}
            </td>
            <td colSpan={2}>
              <a href={`/imports/${c.source.runId}`} className="underline ds-text-2">
                {c.source.fileName} rows {c.source.rowNumbers.slice(0, 5).join(",")}
                {c.source.rowNumbers.length > 5 ? "…" : ""}
              </a>
            </td>
            <td>
              <FlagDialog loadKey={load.loadKey} field={c.kind} oldValue={String(c.amount)} />
            </td>
          </tr>
        ))}
      {expanded &&
        history.map((h, i) => (
          <tr key={`h${i}`} className="border-t text-xs" style={{ borderColor: "var(--hairline)" }}>
            <td />
            <td colSpan={7} className="ds-text-2">
              Correction [{h.status}]: {h.field} → {h.newValue || "—"} — {h.reason} (
              {new Date(h.createdAt).toLocaleDateString()})
            </td>
            <td />
          </tr>
        ))}
    </>
  );
}
