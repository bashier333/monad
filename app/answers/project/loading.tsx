export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div className="h-7 w-48 animate-pulse rounded ds-panel-2" />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded border ds-panel-2" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded border ds-panel-2" />
    </main>
  );
}
