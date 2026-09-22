"use client";

// Global boundary of last resort: root layout crashes land here. Must
// define its own html/body (replacing the broken layout) and cannot rely
// on any app styling or components.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 32, textAlign: "center" }}>
        <h1>Something broke on our side</h1>
        <p>Your data is safe. Try again, or come back later.</p>
        {error.digest ? <p>ref {error.digest}</p> : null}
        <button type="button" onClick={() => reset()}>
          Try again
        </button>
      </body>
    </html>
  );
}
