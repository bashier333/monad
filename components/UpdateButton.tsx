"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type UpdateStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available"; version: string | null }
  | { state: "downloading"; version: string | null; progress: number | null }
  | { state: "downloaded"; version: string | null }
  | { state: "uptodate" }
  | { state: "manual"; message: string | null };

declare global {
  interface Window {
    monad?: {
      checkForUpdates: () => Promise<UpdateStatus>;
      quitAndInstall: () => Promise<unknown>;
      onUpdateStatus: (cb: (s: UpdateStatus) => void) => () => void;
    };
  }
}

function parseFeedVersion(yml: string): string | null {
  const m = /^version:\s*([^\s#]+)/m.exec(yml);
  return m ? m[1]! : null;
}

// Numeric dot-part comparison. Returns negative/0/positive like compareVersions.
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = Number.isFinite(pa[i]) ? (pa[i] as number) : 0;
    const y = Number.isFinite(pb[i]) ? (pb[i] as number) : 0;
    if (x !== y) return x - y;
  }
  return 0;
}

// Update control with two honest modes. Inside the exe it drives the real
// updater over the preload bridge (auto-download off; restart is always a
// human click). In a browser there is no updater to drive, so it compares
// the running version against the published feed and links to /download.
export default function UpdateButton() {
  const [running, setRunning] = useState("");
  const [status, setStatus] = useState<UpdateStatus>({ state: "idle" });
  const [manual, setManual] = useState<{ running: string; latest: string | null; checked: boolean }>({
    running: "",
    latest: null,
    checked: false,
  });

  useEffect(() => {
    if (!window.monad?.onUpdateStatus) return;
    return window.monad.onUpdateStatus((s) => setStatus(s));
  }, []);

  useEffect(() => {
    fetch("/api/desktop")
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { version?: string } | null) => {
        if (b && typeof b.version === "string") setRunning(b.version);
      })
      .catch(() => undefined);
  }, []);

  const checkExe = useCallback(async () => {
    if (!window.monad) return;
    setStatus({ state: "checking" });
    try {
      const s = await window.monad.checkForUpdates();
      setStatus(s);
    } catch {
      setStatus({ state: "manual", message: "Could not reach the updater." });
    }
  }, []);

  const checkBrowser = useCallback(async () => {
    try {
      const res = await fetch("/api/updates/latest.yml", { cache: "no-store" });
      if (!res.ok) {
        setManual((m) => ({ ...m, checked: true, latest: null }));
        return;
      }
      const latest = parseFeedVersion(await res.text());
      setManual((m) => ({ ...m, checked: true, latest }));
    } catch {
      setManual((m) => ({ ...m, checked: true, latest: null }));
    }
  }, []);

  const restart = useCallback(async () => {
    try {
      await window.monad?.quitAndInstall();
    } catch {
      /* main process handles the restart; nothing to render */
    }
  }, []);

  const inExe = typeof window !== "undefined" && !!window.monad?.checkForUpdates;

  return (
    <span className="flex flex-wrap items-center gap-2 text-xs ds-text-2">
      {running ? <span>v{running}</span> : null}
      {inExe ? (
        <>
          {status.state === "downloaded" ? (
            <button
              type="button"
              onClick={() => void restart()}
              className="rounded px-2 py-1 text-[#141413]"
              style={{ background: "var(--accent)" }}
            >
              Restart to install{status.version ? ` v${status.version}` : ""}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void checkExe()}
              disabled={status.state === "checking" || status.state === "downloading"}
              className="ds-state rounded border px-2 py-1 ds-text disabled:opacity-50"
              style={{ borderColor: "var(--hairline)" }}
            >
              {status.state === "checking"
                ? "Checking…"
                : status.state === "downloading"
                  ? `Downloading…${status.progress ?? 0}%`
                  : "Check for updates"}
            </button>
          )}
          {status.state === "uptodate" ? <span>Up to date.</span> : null}
          {status.state === "available" ? (
            <span>Update available{status.version ? ` (v${status.version})` : ""} — downloading on confirm.</span>
          ) : null}
          {status.state === "manual" && status.message ? (
            <span>
              {status.message} <Link href="/download" className="underline">Download</Link>
            </span>
          ) : null}
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => void checkBrowser()}
            className="ds-state rounded border px-2 py-1 ds-text"
            style={{ borderColor: "var(--hairline)" }}
          >
            Check for updates
          </button>
          {manual.checked ? (
            manual.latest && running && compareVersions(manual.latest, running) > 0 ? (
              <span>
                v{manual.latest} published. <Link href="/download" className="underline">Download</Link>
              </span>
            ) : manual.latest ? (
              <span>Up to date (feed: v{manual.latest}).</span>
            ) : (
              <span>No published builds found.</span>
            )
          ) : null}
        </>
      )}
    </span>
  );
}
