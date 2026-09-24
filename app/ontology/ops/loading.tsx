export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4 md:p-8" aria-label="Loading">
      <div className="h-7 w-48 animate-pulse rounded ds-panel-2" />
      <div className="h-64 animate-pulse rounded ds-panel-2" />
    </main>
  );
}
