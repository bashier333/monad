export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl animate-pulse space-y-4 p-4 md:p-8" aria-label="Loading answers">
      <div className="h-6 w-48 rounded bg-gray-200" />
      <div className="h-10 w-full rounded bg-gray-200" />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded bg-gray-200" />
        ))}
      </div>
      <div className="h-64 rounded bg-gray-200" />
    </main>
  );
}
