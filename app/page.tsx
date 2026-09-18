import Link from "next/link";

const SAMPLE_LANES = [
  { lane: "Dallas TX → Houston TX", loads: 14, margin: 2719.93, pct: 76.07 },
  { lane: "Phoenix AZ → El Paso TX", loads: 6, margin: 1376.62, pct: 69.52 },
  { lane: "Houston TX → San Antonio TX", loads: 9, margin: -214.4, pct: -8.3 },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl space-y-10 p-6 md:p-10">
      <section className="space-y-4 pt-6 text-center">
        <h1 className="text-3xl font-bold md:text-4xl">Which lanes made money this week — and why.</h1>
        <p className="mx-auto max-w-xl text-gray-600">
          Upload your TMS, fuel, and broker exports. Get every lane&apos;s margin with the full source
          trail behind each figure. Correct what&apos;s wrong once — it stays fixed.
        </p>
        <div className="flex justify-center gap-3">
          <Link href="/api/auth/signin" className="rounded bg-black px-5 py-2 text-white">
            Start free
          </Link>
          <Link href="/pricing" className="rounded border px-5 py-2">
            Pricing
          </Link>
        </div>
      </section>

      <section className="rounded border p-4">
        <p className="text-xs uppercase tracking-wide text-gray-500">Sample Monday brief</p>
        <p className="mt-1 text-sm">
          Week of Sep 7: $5,555.50 revenue across 29 loads on 3 lanes for $4,096.55 margin (73.7%).
          Best lane Dallas TX → Houston TX ($2,719.93). Worst lane Houston TX → San Antonio TX
          (-$214.40). 1 lane moved more than 6pts.
        </p>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-1">Lane</th>
              <th className="text-right">Loads</th>
              <th className="text-right">Margin</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_LANES.map((l) => (
              <tr key={l.lane} className="border-t">
                <td className="py-1">{l.lane}</td>
                <td className="text-right">{l.loads}</td>
                <td className={`text-right font-medium ${l.margin < 0 ? "text-red-600" : "text-green-700"}`}>
                  ${l.margin.toFixed(2)} ({l.pct}%)
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-gray-500">Sample data. Yours looks like this by Monday.</p>
      </section>

      <section className="grid gap-3 text-sm md:grid-cols-3">
        <div className="rounded border p-4">
          <h2 className="font-medium">1. Upload</h2>
          <p className="mt-1 text-gray-600">TMS, fuel, broker files. Columns detected automatically.</p>
        </div>
        <div className="rounded border p-4">
          <h2 className="font-medium">2. Ask</h2>
          <p className="mt-1 text-gray-600">Every lane&apos;s margin, with the source row behind each figure.</p>
        </div>
        <div className="rounded border p-4">
          <h2 className="font-medium">3. Correct</h2>
          <p className="mt-1 text-gray-600">Flag what&apos;s wrong once — it becomes a rule for every future week.</p>
        </div>
      </section>

      <section className="rounded border border-dashed p-4 text-center text-sm text-gray-600">
        Pilot quotes land here after pilot 1. No fake testimonials.
      </section>

      <footer className="flex flex-wrap justify-center gap-4 border-t pt-4 text-sm text-gray-600">
        <Link href="/pricing" className="underline">Pricing</Link>
        <Link href="/help" className="underline">Help</Link>
        <Link href="/changelog" className="underline">Changelog</Link>
        <Link href="/known-issues" className="underline">Known issues</Link>
        <Link href="/support" className="underline">Support</Link>
      </footer>
    </main>
  );
}
