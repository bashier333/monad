"use client";

import { useMemo, useState } from "react";
import LoadRow, { type FigureHistory } from "@/components/LoadRow";
import type { LoadMargin } from "@/lib/packs/freight/margin/engine";

const PAGE = 100;

type SortKey = "margin-asc" | "margin-desc" | "revenue-desc";

// Loads table: text filter + margin/revenue sort + expand-all, paged at 100.
// (No virtualization dependency: 100-row pages keep the DOM bounded.)
export default function LoadsTable({
  loads,
  historyByLoad,
}: {
  loads: LoadMargin[];
  historyByLoad: Record<string, FigureHistory[]>;
}) {
  const [shown, setShown] = useState(PAGE);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("margin-asc");
  const [expandAll, setExpandAll] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = needle
      ? loads.filter((l) =>
          [l.loadKey, l.driver, l.truck, l.broker].some((v) => (v ?? "").toLowerCase().includes(needle))
        )
      : [...loads];
    if (sort === "margin-asc") rows.sort((a, b) => a.margin - b.margin);
    if (sort === "margin-desc") rows.sort((a, b) => b.margin - a.margin);
    if (sort === "revenue-desc") rows.sort((a, b) => b.revenue - a.revenue);
    return rows;
  }, [loads, q, sort]);

  return (
    <>
      <tbody>
        <tr>
          <td colSpan={9} className="py-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label className="flex items-center gap-1 ds-text-2">
                <span className="sr-only">Filter loads</span>
                <input
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setShown(PAGE); }}
                  placeholder="Filter load, driver, truck…"
                  autoComplete="off"
                  className="ds-control rounded border px-2 py-1 text-sm ds-text"
                  style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
                />
              </label>
              <label className="flex items-center gap-1 ds-text-2">
                Sort
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="ds-control rounded border px-1 py-1 text-sm ds-text"
                  style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
                >
                  <option value="margin-asc">Worst margin first</option>
                  <option value="margin-desc">Best margin first</option>
                  <option value="revenue-desc">Highest revenue first</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => setExpandAll((v) => !v)}
                aria-expanded={expandAll}
                className="ds-state rounded border px-2 py-1 text-sm ds-text"
                style={{ borderColor: "var(--hairline)" }}
              >
                {expandAll ? "Collapse all" : "Expand all"}
              </button>
              <span className="ds-text-2">
                {filtered.length} of {loads.length} loads
              </span>
            </div>
          </td>
        </tr>
        {filtered.slice(0, shown).map((l) => (
          <LoadRow key={l.loadKey} load={l} history={historyByLoad[l.loadKey] ?? []} expandAll={expandAll} />
        ))}
      </tbody>
      {shown < filtered.length && (
        <tfoot>
          <tr>
            <td colSpan={9} className="py-2 text-center text-sm ds-text-2">
              Showing {shown} of {filtered.length} loads.{" "}
              <button onClick={() => setShown((s) => s + PAGE)} className="underline">
                Show {Math.min(PAGE, filtered.length - shown)} more
              </button>
            </td>
          </tr>
        </tfoot>
      )}
    </>
  );
}
