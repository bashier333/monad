"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Hub sub-navigation: each of the five sidebar worlds lists its six
// rooms on its own landing page. No orphan pages, no maze: if it belongs
// to a hub, the hub links it. Items live in components/hub-nav (server-safe
// data); this file is the interactive shell only.
export default function HubNav({ items }: { items: Array<{ href: string; label: string }> }) {
  const pathname = usePathname();
  const base = (h: string) => h.split("#")[0];
  return (
    <nav aria-label="Section" className="flex flex-wrap gap-1.5">
      {items.map((i) => {
        const active = pathname === base(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className="ds-state rounded-full border px-3 py-1 text-[13px]"
            style={
              active
                ? { borderColor: "var(--accent)", color: "var(--accent)", fontWeight: 600 }
                : { borderColor: "var(--hairline)", color: "var(--fg-2)" }
            }
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
