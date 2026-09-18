"use client";

import { useState } from "react";
import LoadRow, { type FigureHistory } from "@/components/LoadRow";
import type { LoadMargin } from "@/lib/margin/engine";

const PAGE = 100;

export default function LoadsTable({
  loads,
  historyByLoad,
}: {
  loads: LoadMargin[];
  historyByLoad: Record<string, FigureHistory[]>;
}) {
  const [shown, setShown] = useState(PAGE);
  return (
    <>
      <tbody>
        {loads.slice(0, shown).map((l) => (
          <LoadRow key={l.loadKey} load={l} history={historyByLoad[l.loadKey] ?? []} />
        ))}
      </tbody>
      {shown < loads.length && (
        <tfoot>
          <tr>
            <td colSpan={9} className="py-2 text-center text-sm">
              Showing {shown} of {loads.length} loads.{" "}
              <button onClick={() => setShown((s) => s + PAGE)} className="underline">
                Show {Math.min(PAGE, loads.length - shown)} more
              </button>
            </td>
          </tr>
        </tfoot>
      )}
    </>
  );
}
