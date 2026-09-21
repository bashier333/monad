export default function Loading() {
  return (
    <main className="mx-auto max-w-4xl animate-pulse space-y-4 p-4 md:p-8" aria-busy="true">
      <div className="ds-panel h-6 w-40 rounded" role="status" aria-label="Loading search" />
      <div className="ds-panel h-10 w-full rounded" role="status" aria-label="Loading search box" />
      <div className="ds-panel h-48 rounded" role="status" aria-label="Loading results" />
    </main>
  );
}
