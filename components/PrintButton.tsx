"use client";

export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="rounded border px-3 py-1 text-sm">
      Print / save PDF
    </button>
  );
}
