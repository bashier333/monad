"use client";

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

export default function LoadRow({ load, history }: { load: LoadMargin; history: FigureHistory[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className="border-t">
        <td className="py-1 font-mono">{load.loadKey}</td>
        <td>{load.date}</td>
        <td>{load.driver}</td>
        <td>{load.truck}</td>
        <td>{load.broker || "—"}</td>
        <td className="text-right">${load.revenue.toFixed(2)}</td>
        <td className="text-right">${load.totalCost.toFixed(2)}</td>
        <td className={`text-right font-medium ${load.margin < 0 ? "text-red-600" : "text-green-700"}`}>
          ${load.margin.toFixed(2)}
        </td>
        <td>
          <button onClick={() => setOpen((o) => !o)} className="underline" aria-label={`cost lines for ${load.loadKey}`}>
            {open ? "hide" : `${load.costs.length} lines`}
          </button>
        </td>
      </tr>
      {open &&
        load.costs.map((c, i) => (
          <tr key={i} className="border-t bg-gray-50 text-xs">
            <td />
            <td colSpan={3}>
              {c.label} <span className="text-gray-500">({c.ruleId})</span>
            </td>
            <td colSpan={2} className="text-right">
              ${c.amount.toFixed(2)}
            </td>
            <td colSpan={2}>
              <a href={`/imports/${c.source.runId}`} className="underline">
                {c.source.fileName} rows {c.source.rowNumbers.slice(0, 5).join(",")}
                {c.source.rowNumbers.length > 5 ? "…" : ""}
              </a>
            </td>
            <td>
              <FlagDialog loadKey={load.loadKey} field={c.kind} oldValue={String(c.amount)} />
            </td>
          </tr>
        ))}
      {open &&
        history.map((h, i) => (
          <tr key={`h${i}`} className="border-t bg-amber-50 text-xs">
            <td />
            <td colSpan={7}>
              Correction [{h.status}]: {h.field} → {h.newValue || "—"} — {h.reason} (
              {new Date(h.createdAt).toLocaleDateString()})
            </td>
            <td />
          </tr>
        ))}
    </>
  );
}
