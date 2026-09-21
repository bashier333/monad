"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { trackFunnel } from "@/lib/analytics";

// Upload form: drag-drop + file picker, auto type detection explained in
// plain words, inline progress states, and a real Upgrade action on 402
// instead of dead red text. Successful uploads route to /imports/[id],
// which owns the processing progress UI.
export default function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [sourceType, setSourceType] = useState("auto");
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [message, setMessage] = useState("");
  const [paywalled, setPaywalled] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!file || state === "busy") return;
    setState("busy");
    setMessage("");
    setPaywalled(false);
    trackFunnel("upload_started", { filename: file.name, bytes: file.size });
    const form = new FormData();
    form.set("file", file);
    form.set("sourceType", sourceType);
    let res: Response;
    try {
      res = await fetch("/api/uploads", { method: "POST", body: form });
    } catch {
      setState("error");
      setMessage("Upload failed — check your connection and try again.");
      return;
    }
    const body = (await res.json().catch(() => ({}))) as { runId?: string; error?: string };
    if (!res.ok || !body.runId) {
      setState("error");
      setMessage(body.error ?? "upload failed");
      if (res.status === 402) {
        setPaywalled(true);
        trackFunnel("upgrade_clicked", { from: "upload_402" });
      }
      return;
    }
    trackFunnel("upload_completed", { filename: file.name });
    window.location.href = `/imports/${body.runId}`;
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) setFile(f);
      }}
      className="ds-panel flex flex-col gap-3 rounded p-4"
      style={{ borderColor: dragOver ? "var(--accent)" : "var(--hairline)" }}
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="ds-state rounded border border-dashed p-6 text-center"
        style={{ borderColor: "var(--hairline)" }}
        aria-label="Choose a file to upload, or drag and drop it here"
      >
        <span className="block text-sm font-medium ds-text">
          {file ? file.name : "Drop a .csv or .xlsx here, or click to choose"}
        </span>
        <span className="mt-1 block text-xs ds-text-2">Max 50MB. Processing starts immediately after upload.</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <label className="text-sm font-medium ds-text">
        Source type
        <select
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value)}
          className="ds-control mt-1 block rounded border p-1 ds-text"
          style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
        >
          <option value="auto">Auto (from filename)</option>
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
      <p className="text-xs ds-text-2">
        Auto reads the file name (e.g. <span className="font-mono">tms-…​.csv</span>,{" "}
        <span className="font-mono">fuel-…​.csv</span>) and picks the matching importer. Choose a type
        explicitly only when Auto guesses wrong — you can remap columns on the next screen.
      </p>
      <button
        type="submit"
        disabled={!file || state === "busy"}
        className="ds-control rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
        style={{ background: "var(--accent)", color: "#141413" }}
      >
        {state === "busy" ? "Uploading…" : "Upload & process"}
      </button>
      {message && (
        <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
          {message}{" "}
          {paywalled && (
            <Link href="/pricing" className="font-medium underline">
              Upgrade to Team
            </Link>
          )}
        </p>
      )}
    </form>
  );
}
