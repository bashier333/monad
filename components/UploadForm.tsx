"use client";

import { useState } from "react";

export default function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState("tms");
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setState("busy");
    setMessage("");
    const form = new FormData();
    form.set("file", file);
    form.set("sourceType", sourceType);
    const res = await fetch("/api/uploads", { method: "POST", body: form });
    const body = (await res.json()) as { runId?: string; error?: string };
    if (!res.ok || !body.runId) {
      setState("error");
      setMessage(body.error ?? "upload failed");
      return;
    }
    window.location.href = `/imports/${body.runId}`;
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded border p-4">
      <label className="text-sm font-medium">
        File (.csv or .xlsx, max 50MB)
        <input
          type="file"
          accept=".csv,.xlsx"
          className="mt-1 block"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <label className="text-sm font-medium">
        Source type
        <select
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value)}
          className="mt-1 block rounded border p-1"
        >
          <option value="tms">TMS / dispatch export</option>
          <option value="fuel">Fuel CSV</option>
          <option value="broker">Broker statement</option>
          <option value="time">Time tracking export (studio)</option>
          <option value="revision">Revision log (studio)</option>
          <option value="approval">Approval log (studio)</option>
          <option value="invoice">Invoice export (studio)</option>
          <option value="asset">Asset manifest (studio)</option>
          <option value="rate">Rate card (studio)</option>
          <option value="project">Project list (studio)</option>
          <option value="feedback">Feedback thread export (studio)</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={!file || state === "busy"}
        className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {state === "busy" ? "Uploading…" : "Upload & process"}
      </button>
      {message && <p className="text-sm text-red-600">{message}</p>}
    </form>
  );
}
