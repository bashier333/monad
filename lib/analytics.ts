"use client";

type TrackProps = Record<string, string | number | boolean>;

let enabled = false;

export function initAnalytics() {
  if (typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
  if (!key) return;
  void import("posthog-js").then(({ default: posthog }) => {
    posthog.init(key, { api_host: host });
    enabled = true;
  });
}

export function track(event: string, props: TrackProps = {}) {
  if (!enabled || typeof window === "undefined") return;
  void import("posthog-js").then(({ default: posthog }) => posthog.capture(event, props));
}
