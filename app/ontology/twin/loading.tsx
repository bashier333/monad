export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true">
      <div className="ds-panel h-24 rounded" role="status" aria-label="Loading twin" />
      <div className="grid gap-4 md:grid-cols-2" role="status" aria-label="Loading charts">
        <div className="ds-panel h-[280px] rounded" />
        <div className="ds-panel h-[280px] rounded" />
      </div>
    </div>
  );
}
