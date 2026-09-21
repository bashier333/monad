"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Inbox freshness: manual refresh plus a 60s poll so approvals decided in
// another tab don't sit stale. Polling only refetches server data (no
// timers on individual rows, no per-second announcements).
export default function InboxRefresh() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 60000);
    return () => clearInterval(t);
  }, [router]);
  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      className="ds-state rounded border px-3 py-1.5 text-sm ds-text"
      style={{ borderColor: "var(--hairline)" }}
    >
      Refresh
    </button>
  );
}
