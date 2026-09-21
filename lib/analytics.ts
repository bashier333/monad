"use client";

type TrackProps = Record<string, string | number | boolean>;

// Funnel event catalog (10x plan §1): every growth-relevant action emits one
// of these so activation × habit × expansion is measured, not claimed.
export type FunnelEvent =
  | "upload_started"
  | "upload_completed"
  | "mapping_confirmed"
  | "first_answer"
  | "flag_created"
  | "flag_decided"
  | "rule_created"
  | "brief_generated"
  | "brief_opened_in_meeting"
  | "share_created"
  | "share_viewed"
  | "upgrade_clicked";

let enabled = false;
const queue: Array<{ event: string; props: TrackProps }> = [];
// Single shared import: init + every track call reuse one posthog-js load.
let posthogPromise: Promise<{ capture: (e: string, p?: TrackProps) => void; init: (k: string, o: Record<string, unknown>) => void }> | null = null;

function loadPosthog() {
  if (!posthogPromise) {
    posthogPromise = import("posthog-js").then((m) => m.default);
  }
  return posthogPromise;
}

function flush(posthog: { capture: (e: string, p?: TrackProps) => void }) {
  for (const item of queue.splice(0, queue.length)) {
    try {
      posthog.capture(item.event, item.props);
    } catch {
      /* analytics must never break the app */
    }
  }
}

export function initAnalytics() {
  if (typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
  if (!key) return;
  void loadPosthog().then((posthog) => {
    posthog.init(key, {
      api_host: host,
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
      respect_dnt: true,
    });
    enabled = true;
    flush(posthog);
  });
}

export function track(event: string, props: TrackProps = {}) {
  if (typeof window === "undefined") return;
  if (!enabled) {
    // Buffer until posthog.init resolves instead of dropping: early events
    // (first paint vitals, first_answer) are the ones that matter most.
    if (queue.length < 100) queue.push({ event, props });
    return;
  }
  void loadPosthog().then((posthog) => {
    flush(posthog);
    posthog.capture(event, props);
  });
}

// Typed funnel helper: keeps event names greppable and consistent.
export function trackFunnel(event: FunnelEvent, props: TrackProps = {}) {
  track(event, props);
}
