"use client";

import type { ReactNode } from "react";
import SpringIn from "@/components/motion";

// Scroll entrance for marketing sections. Same props as always
// (className/delay); the spring lives in components/motion so every
// entrance on every page shares one physical feel.
export default function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <SpringIn className={className} delay={delay}>
      {children}
    </SpringIn>
  );
}
