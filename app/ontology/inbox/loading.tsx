export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4 md:p-8" aria-label="Loading inbox">
      <div className="h-7 w-48 animate-pulse rounded ds-panel-2" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded ds-panel-2" />
      ))}
    </main>
  );
}
