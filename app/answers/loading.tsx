export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl animate-pulse space-y-4 p-4 md:p-8" aria-busy="true">
      <div className="ds-panel h-6 w-48 rounded" role="status" aria-label="Loading answers" />
      <div className="ds-panel h-10 w-full rounded" role="status" aria-label="Loading filters" />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4" role="status" aria-label="Loading totals">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="ds-panel h-12 rounded" />
        ))}
      </div>
      <div className="ds-panel h-64 rounded" role="status" aria-label="Loading lanes" />
    </main>
  );
}
