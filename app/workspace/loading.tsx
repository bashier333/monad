export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4 md:p-8" aria-label="Loading workspace">
      <div className="h-7 w-48 animate-pulse rounded ds-panel-2" />
      <div className="h-10 w-full animate-pulse rounded ds-panel-2" />
      <div className="grid gap-4 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded ds-panel-2" />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded ds-panel-2" />
    </main>
  );
}
