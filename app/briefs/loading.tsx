export default function Loading() {
  return (
    <main className="mx-auto max-w-3xl animate-pulse space-y-4 p-4 md:p-8" aria-busy="true">
      <div className="ds-panel h-6 w-40 rounded" role="status" aria-label="Loading briefs" />
      <div className="ds-panel h-32 rounded" role="status" aria-label="Loading brief list" />
      <div className="ds-panel h-32 rounded" />
    </main>
  );
}
