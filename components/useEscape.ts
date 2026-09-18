"use client";

import { useEffect, useRef } from "react";

export function useEscape<T extends HTMLElement>(onEscape: () => void): React.RefObject<T | null> {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    ref.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onEscape]);
  return ref;
}
