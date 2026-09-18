"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

export default function VitalsReporter() {
  useEffect(() => {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const e = entry as PerformanceEntry & { value?: number; id?: string };
          track("web-vital", {
            name: entry.name,
            value: Math.round(e.value ?? (entry as PerformanceEventTiming).duration ?? 0),
          });
        }
      });
      observer.observe({ type: "largest-contentful-paint", buffered: true });
      observer.observe({ type: "layout-shift", buffered: true });
      return () => observer.disconnect();
    } catch {
      return;
    }
  }, []);
  return null;
}
