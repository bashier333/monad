export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4 md:p-8" aria-label="Loading board">
      <div className="h-7 w-56 animate-pulse rounded ds-panel-2" />
      <div className="grid gap-2 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded ds-panel-2" />
        ))}
      </div>
      <div className="h-[380px] animate-pulse rounded ds-panel-2" />
    </main>
  );
}
