"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Bell from "@/components/Bell";
import ThemeToggle from "@/components/ThemeToggle";
import DensityToggle from "@/components/DensityToggle";
import { ShortcutsModal } from "@/components/ShortcutsModal";

// Five primary destinations (the money loop) + a More sheet for the rest.
// One row at 360px: primaries compress, overflow lives in More.
const PRIMARY = [
  ["Workspace", "/workspace"],
  ["Answers", "/answers"],
  ["Upload", "/upload"],
  ["Briefs", "/briefs"],
  ["Corrections", "/corrections"],
] as const;

const MORE = [
  ["Search", "/search"],
  ["Projects", "/answers/projects"],
  ["Packs", "/packs"],
  ["Rules", "/rules"],
  ["Pilots", "/pilots"],
  ["Studio", "/ontology"],
  ["Twin", "/ontology/twin"],
  ["Automations", "/ontology/automations"],
  ["Settings", "/settings"],
  ["Help", "/help"],
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/workspace" && pathname.startsWith(`${href}/`));
}

export default function TopNav() {
  const pathname = usePathname();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");
      if (e.key === "?" && !typing) {
        e.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openPalette = () => window.dispatchEvent(new CustomEvent("monad:open-palette"));

  return (
    <nav className="border-b" aria-label="Primary" style={{ borderColor: "var(--hairline)" }}>
      <div className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-2 text-sm md:px-8">
        <Link href="/workspace" className="mr-1 shrink-0 font-bold ds-text">
          Monad
        </Link>
        {PRIMARY.map(([label, href]) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="ds-state shrink-0 rounded px-2 py-1 ds-text-2"
              style={active ? { background: "var(--accent)", color: "#141413", fontWeight: 500 } : undefined}
            >
              {label}
            </Link>
          );
        })}
        <details className="relative shrink-0">
          <summary className="ds-state cursor-pointer list-none rounded px-2 py-1 ds-text-2">More</summary>
          <div
            className="absolute left-0 z-40 mt-1 flex min-w-44 flex-col rounded p-1 ds-panel"
            style={{ borderColor: "var(--hairline)", background: "var(--panel)" }}
          >
            {MORE.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(pathname, href) ? "page" : undefined}
                className="ds-state rounded px-2 py-1.5 ds-text"
              >
                {label}
              </Link>
            ))}
          </div>
        </details>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={openPalette}
            aria-keyshortcuts="Control+k Meta+k"
            title="Command palette (Ctrl/⌘+K)"
            className="ds-state rounded border px-2 py-1 font-mono text-xs ds-text-2"
            style={{ borderColor: "var(--hairline)" }}
          >
            ⌘K
          </button>
          <button
            type="button"
            onClick={() => setShortcutsOpen(true)}
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
            className="ds-state rounded border px-2 py-1 font-mono text-xs ds-text-2"
            style={{ borderColor: "var(--hairline)" }}
          >
            ?
          </button>
          <ThemeToggle />
          <DensityToggle />
          <Bell />
        </span>
      </div>
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </nav>
  );
}
