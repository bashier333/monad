export default function LaneLoading() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8" aria-busy="true">
      <div className="ds-panel h-5 w-40 animate-pulse rounded" role="status" aria-label="Loading lane" />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4" role="status" aria-label="Loading stats">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="ds-panel h-16 animate-pulse rounded" />
        ))}
      </div>
      <div className="ds-panel h-64 animate-pulse rounded" role="status" aria-label="Loading loads" />
    </main>
  );
}
