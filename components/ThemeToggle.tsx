"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

// Persisted theme toggle. Dark is the desktop default (SSR renders .dark
// when MONAD_DESKTOP=1); this control only records an explicit choice.
export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("monad-theme");
      if (stored === "light" || stored === "dark") {
        setTheme(stored);
      } else {
        setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
      }
    } catch {
      /* keep default */
    }
    setReady(true);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("monad-theme", next);
    } catch {
      /* storage unavailable */
    }
    document.documentElement.classList.toggle("dark", next === "dark");
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={ready && theme === "dark"}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={theme === "dark" ? "Light theme" : "Dark theme"}
      className="ds-state flex items-center gap-1.5 rounded border px-2 py-1 text-xs"
      style={{ borderColor: "var(--hairline)", color: "var(--fg-2)" }}
    >
      {theme === "dark" ? <Sun size={14} aria-hidden /> : <Moon size={14} aria-hidden />}
      <span>{ready ? theme : "…"}</span>
    </button>
  );
}
