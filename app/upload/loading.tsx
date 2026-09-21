export default function Loading() {
  return (
    <main className="mx-auto max-w-3xl animate-pulse space-y-6 p-8" aria-busy="true">
      <div className="ds-panel h-6 w-48 rounded" role="status" aria-label="Loading upload" />
      <div className="ds-panel h-48 rounded" role="status" aria-label="Loading upload form" />
      <div className="ds-panel h-32 rounded" role="status" aria-label="Loading import history" />
    </main>
  );
}
