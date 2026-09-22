"use client";

// Root route boundary: any render crash below the layout lands here instead
// of a white screen. Offers a retry and a way home; details stay in the
// server logs (never leaked to the page).
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-2xl p-8 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Something broke on our side</h1>
      <p className="mt-2 text-[15px] ds-text-2">
        Your data is safe — nothing was written by the crash. Try again, or head back to the workspace.
        {error.digest ? ` (ref ${error.digest})` : ""}
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full px-5 py-2 text-[15px] font-semibold text-white"
          style={{ background: "var(--accent)" }}
        >
          Try again
        </button>
        <a href="/workspace" className="rounded-full border px-5 py-2 text-[15px] underline ds-text" style={{ borderColor: "var(--hairline)" }}>
          Workspace
        </a>
      </div>
    </main>
  );
}
