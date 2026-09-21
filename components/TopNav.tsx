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
    <nav
      aria-label="Primary"
      className="sticky top-0 z-40 border-b backdrop-blur"
      style={{ borderColor: "var(--hairline)", background: "color-mix(in srgb, var(--panel) 88%, transparent)" }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-1 px-4 text-sm md:px-8">
        <Link href="/workspace" className="mr-2 flex shrink-0 items-center gap-2">
          <span aria-hidden className="inline-block h-5 w-5 rounded-[5px]" style={{ background: "var(--accent)" }} />
          <span className="font-semibold tracking-tight ds-text">Monad</span>
        </Link>
        {PRIMARY.map(([label, href]) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="ds-state hidden shrink-0 rounded-md px-2.5 py-1.5 sm:block"
              style={
                active
                  ? {
                      background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                      color: "var(--accent)",
                      fontWeight: 600,
                    }
                  : undefined
              }
            >
              <span className={active ? "" : "ds-text-2"}>{label}</span>
            </Link>
          );
        })}
        <details className="relative shrink-0 sm:hidden">
          <summary className="ds-state cursor-pointer list-none rounded-md px-2.5 py-1.5 ds-text-2">
            Menu
          </summary>
          <div
            className="absolute left-0 z-40 mt-1 flex min-w-44 flex-col rounded-lg p-1 ds-panel"
            style={{ borderColor: "var(--hairline)", background: "var(--panel)" }}
          >
            {[...PRIMARY, ...MORE].map(([label, href]) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(pathname, href) ? "page" : undefined}
                className="ds-state rounded-md px-2 py-1.5 ds-text"
              >
                {label}
              </Link>
            ))}
          </div>
        </details>
        <details className="relative hidden shrink-0 sm:block">
          <summary className="ds-state cursor-pointer list-none rounded-md px-2.5 py-1.5 ds-text-2">
            More
          </summary>
          <div
            className="absolute left-0 z-40 mt-1 flex min-w-44 flex-col rounded-lg p-1 ds-panel"
            style={{ borderColor: "var(--hairline)", background: "var(--panel)" }}
          >
            {MORE.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(pathname, href) ? "page" : undefined}
                className="ds-state rounded-md px-2 py-1.5 ds-text"
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
