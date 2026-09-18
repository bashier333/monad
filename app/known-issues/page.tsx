export default function KnownIssuesPage() {
  const issues = [
    "PDF export = print-to-PDF from the brief page (no PDF library in beta).",
    "Background jobs run in-process: a server restart mid-import needs /api/admin/sweep or re-upload.",
    "Column auto-detect handles standard TMS/fuel/broker layouts; exotic layouts need manual mapping (saved for next time).",
    "Fuel is split by miles per truck per week — tolls and reefer fuel are not modeled yet.",
    "Overhead is not allocated — margins shown are contribution margins.",
    "Free tier: 10 uploads/month, 90-day answer history.",
  ];
  return (
    <main className="mx-auto max-w-2xl space-y-3 p-8 text-sm">
      <h1 className="text-xl font-bold">Known issues</h1>
      <p className="text-gray-600">Updated weekly. If it is not here and it hurts, it is a bug — tell us.</p>
      <ul className="list-disc space-y-1 pl-5">
        {issues.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </main>
  );
}
