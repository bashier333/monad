"use client";

import { useEffect, useState } from "react";
import { Rows3 } from "lucide-react";

// Persisted density toggle: comfort (default, 52px rows) vs compact (40px).
// Writes data-density on <html>; tables consume --row-h/--cell-py tokens.
// Hit targets, pickers, dialogs, and focus rings never densify (see CSS).
export default function DensityToggle() {
  const [density, setDensity] = useState<"comfort" | "compact">("comfort");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("monad-density");
      if (stored === "compact") {
        setDensity("compact");
      } else {
        setDensity(document.documentElement.getAttribute("data-density") === "compact" ? "compact" : "comfort");
      }
    } catch {
      /* keep default */
    }
    setReady(true);
  }, []);

  function toggle() {
    const next = density === "comfort" ? "compact" : "comfort";
    try {
      localStorage.setItem("monad-density", next);
    } catch {
      /* storage unavailable */
    }
    if (next === "compact") {
      document.documentElement.setAttribute("data-density", "compact");
    } else {
      document.documentElement.removeAttribute("data-density");
    }
    setDensity(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={ready && density === "compact"}
      aria-label={density === "compact" ? "Switch to comfortable density" : "Switch to compact density"}
      title={density === "compact" ? "Comfortable density" : "Compact density"}
      className="ds-state flex items-center gap-1.5 rounded border px-2 py-1 text-xs"
      style={{ borderColor: "var(--hairline)", color: "var(--fg-2)" }}
    >
      <Rows3 size={14} aria-hidden />
      <span>{ready ? density : "…"}</span>
    </button>
  );
}
