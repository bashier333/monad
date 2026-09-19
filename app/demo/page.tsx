import Link from "next/link";
import { readFile } from "fs/promises";
import path from "path";
import { parseBuffer } from "@/lib/core/ingest/parse";
import { detectColumns, applyMapping } from "@/lib/core/ingest/columns";
import { computeProjectMargins } from "@/lib/packs/agency/engine";
import { AGENCY_ALIASES, AGENCY_FIELDS } from "@/lib/packs/agency/fields";

export const dynamic = "force-static";

export default async function DemoPage() {
  const buf = await readFile(path.join(process.cwd(), "fixtures", "agency-video-week.csv"));
  const { headers, rows } = parseBuffer("agency-video-week.csv", buf);
  const { mapping } = detectColumns(headers, AGENCY_FIELDS, AGENCY_ALIASES);
  const mapped = applyMapping(headers, rows, mapping, AGENCY_FIELDS);
  const result = computeProjectMargins(
    mapped.map((m, i) => ({
      recordKey: `D${i}`,
      date: m.record.date,
      project: m.record.project,
      client: "",
      person: m.record.person,
      task: m.record.task,
      hours: m.record.hours,
      rate: m.record.rate,
      revenue: "",
      runId: "demo",
      fileName: "agency-video-week.csv",
      rowNumber: m.rowNumber,
    })),
    [],
    [],
    [],
    new Map(),
    [],
    "2026-09-07",
    "2026-09-13",
  );

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 md:p-8">
      <p className="rounded border border-blue-300 bg-blue-50 p-3 text-sm">
        Sample week — real studio shape, fake numbers. No signup needed to peek.{" "}
        <Link href="/api/auth/signin" className="underline">
          Sign in
        </Link>{" "}
        to upload your own.
      </p>
      <h1 className="text-xl font-bold">Project margins (sample)</h1>
      <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
        <div className="rounded border p-2">Cost: ${result.totals.cost.toFixed(2)}</div>
        <div className="rounded border p-2">Margin: ${result.totals.margin.toFixed(2)}</div>
        <div className="rounded border p-2">Revisions: {result.totals.revisions}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm" aria-label="Sample project margins">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-1" scope="col">Project</th>
              <th className="text-right" scope="col">Rounds</th>
              <th className="text-right" scope="col">Cost</th>
            </tr>
          </thead>
          <tbody>
            {[...result.projects]
              .sort((a, b) => a.margin - b.margin)
              .map((p) => (
                <tr key={p.project} className="border-t">
                  <td className="py-1">{p.project}</td>
                  <td className="text-right">{p.revisions}</td>
                  <td className="text-right">${p.cost.toFixed(2)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
