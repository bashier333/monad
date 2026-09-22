"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Scroll-merge fade for the sticky hero: as the page scrolls, the hero
// content drifts up, shrinks slightly, and dissolves into the section
// sliding over it. Skipped entirely under reduced-motion (layout merge
// still happens — that is native scrolling, not animation).
export default function HeroFade({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const p = Math.min(1, window.scrollY / Math.max(1, window.innerHeight));
        el.style.opacity = String(1 - p * 0.9);
        el.style.transform = `translateY(${p * -60}px) scale(${1 - p * 0.04})`;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className="will-change-transform">
      {children}
    </div>
  );
}
