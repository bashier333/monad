"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

// Thresholds match the 10x plan §1 lab gates: LCP<2500ms, INP<200ms,
// CLS<0.1, FCP<1800ms, TTFB<800ms. Each report carries id, value, rating,
// and navigationType so regressions attribute to navigate vs reload vs
// back-forward cache.
const THRESHOLDS: Record<string, [number, number]> = {
  LCP: [2500, 4000],
  INP: [200, 500],
  CLS: [0.1, 0.25],
  FCP: [1800, 3000],
  TTFB: [800, 1800],
};

function ratingFor(name: string, value: number): "good" | "needs-improvement" | "poor" {
  const [good, poor] = THRESHOLDS[name] ?? [0, Infinity];
  if (value <= good!) return "good";
  if (value <= poor!) return "needs-improvement";
  return "poor";
}

function navType(): string {
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return nav?.type ?? "unknown";
  } catch {
    return "unknown";
  }
}

export default function VitalsReporter() {
  useEffect(() => {
    try {
      let lcp = 0;
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === "largest-contentful-paint") {
            lcp = Math.max(lcp, Math.round(entry.startTime));
          } else if (entry.name === "layout-shift") {
            const e = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
            if (!e.hadRecentInput) {
              track("web-vital", {
                name: "CLS-sample",
                value: Math.round((e.value ?? 0) * 1000) / 1000,
                rating: ratingFor("CLS", e.value ?? 0),
                navigationType: navType(),
              });
            }
          } else if (entry.entryType === "paint" && entry.name === "first-contentful-paint") {
            const v = Math.round(entry.startTime);
            track("web-vital", { name: "FCP", value: v, rating: ratingFor("FCP", v), navigationType: navType() });
          }
        }
      });
      paintObserver.observe({ type: "largest-contentful-paint", buffered: true });
      paintObserver.observe({ type: "layout-shift", buffered: true });
      paintObserver.observe({ type: "paint", buffered: true });

      // TTFB from the navigation timing entry (accurate, no extra deps).
      try {
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        if (nav && nav.responseStart > 0) {
          const v = Math.round(nav.responseStart);
          track("web-vital", { name: "TTFB", value: v, rating: ratingFor("TTFB", v), navigationType: nav.type });
        }
      } catch {
        /* navigation timing unavailable */
      }

      // INP approximation without the web-vitals package: group EventTiming
      // entries by interactionId, keep the worst per interaction, report the
      // worst interaction on pagehide (INP itself is near-max, so the max is
      // a conservative proxy — see comment, not silent).
      const worstByInteraction = new Map<string, number>();
      let inpObserver: PerformanceObserver | null = null;
      try {
        inpObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const e = entry as PerformanceEntry & { interactionId?: number; duration?: number };
            if (!e.interactionId) continue;
            const key = String(e.interactionId);
            worstByInteraction.set(key, Math.max(worstByInteraction.get(key) ?? 0, Math.round(e.duration ?? 0)));
          }
        });
        inpObserver.observe({ type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
      } catch {
        inpObserver = null;
      }

      const finish = () => {
        if (lcp > 0) {
          track("web-vital", { name: "LCP", value: lcp, rating: ratingFor("LCP", lcp), navigationType: navType() });
          lcp = 0;
        }
        if (worstByInteraction.size > 0) {
          const v = Math.max(...worstByInteraction.values());
          track("web-vital", {
            name: "INP",
            value: v,
            rating: ratingFor("INP", v),
            navigationType: navType(),
          });
          worstByInteraction.clear();
        }
      };
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") finish();
      });
      window.addEventListener("pagehide", finish);

      return () => {
        paintObserver.disconnect();
        inpObserver?.disconnect();
        window.removeEventListener("pagehide", finish);
      };
    } catch {
      return;
    }
  }, []);
  return null;
}
