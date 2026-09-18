import Link from "next/link";

export function EmptyState({ title, body, actionHref, actionLabel }: { title: string; body: string; actionHref: string; actionLabel: string }) {
  return (
    <div className="rounded border p-6 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-gray-600">{body}</p>
      <p className="mt-2 text-sm">
        <Link href={actionHref} className="underline">
          {actionLabel}
        </Link>
      </p>
    </div>
  );
}

export function StatCards({ stats }: { stats: Array<{ label: string; value: string; tone?: "good" | "bad" | "neutral" }> }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded border p-2">
          <span className="text-gray-500">{s.label}: </span>
          <span className={s.tone === "bad" ? "text-red-600" : s.tone === "good" ? "text-green-700" : "font-medium"}>
            {s.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TrailList({ rules }: { rules: Array<{ id: string; sentence: string }> }) {
  return (
    <ul className="mt-1 list-disc pl-5 text-gray-700">
      {rules.map((r) => (
        <li key={r.id}>
          <span className="font-mono">{r.id}</span> — {r.sentence}
        </li>
      ))}
    </ul>
  );
}

export function DataTable({
  columns,
  rows,
  minWidth = 640,
}: {
  columns: string[];
  rows: React.ReactNode[][];
  minWidth?: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead>
          <tr className="text-left text-gray-500">
            {columns.map((c, i) => (
              <th key={i} className="py-1" style={i > 0 ? { textAlign: "right" } : undefined}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i} className="border-t">
            {r.map((cell, j) => (
              <td key={j} className={j === 0 ? "py-1" : "text-right"}>
                {cell}
              </td>
            ))}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
