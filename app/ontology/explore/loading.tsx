export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true">
      <div className="ds-panel h-10 w-full rounded" role="status" aria-label="Loading explorer" />
      <div className="ds-panel h-48 rounded" role="status" aria-label="Loading graph" />
    </div>
  );
}
