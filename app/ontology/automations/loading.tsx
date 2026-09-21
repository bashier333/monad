export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true">
      <div className="ds-panel h-10 w-full rounded" role="status" aria-label="Loading automations" />
      <div className="ds-panel h-64 rounded" role="status" aria-label="Loading agent console" />
    </div>
  );
}
