"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Hub sub-navigation: each of the five sidebar worlds lists its six
// rooms on its own landing page. No orphan pages, no maze: if it belongs
// to a hub, the hub links it.
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

export const HUBS = {
  workspace: [
    { href: "/search", label: "Search" },
    { href: "/activity", label: "Activity" },
    { href: "/answers", label: "Answers" },
    { href: "/briefs", label: "Briefs" },
    { href: "/packs", label: "Packs" },
    { href: "/pilots", label: "Pilots" },
  ],
  board: [
    { href: "/ontology/twin", label: "Twin" },
    { href: "/ontology/explore", label: "Explore" },
    { href: "/ontology", label: "Schema" },
    { href: "/ontology/actions", label: "Actions" },
    { href: "/ontology/scenarios", label: "Scenarios" },
    { href: "/ontology/audit", label: "Audit" },
  ],
  connect: [
    { href: "/sync", label: "Connectors" },
    { href: "/packs", label: "Packs" },
    { href: "/answers", label: "Answers" },
    { href: "/briefs", label: "Briefs" },
    { href: "/ontology/board", label: "Board" },
    { href: "/help", label: "Docs" },
  ],
  inbox: [
    { href: "/ontology/inbox", label: "Approvals" },
    { href: "/corrections", label: "Corrections" },
    { href: "/rules", label: "Rules" },
    { href: "/ontology/actions", label: "Actions" },
    { href: "/ontology/automations", label: "Automations" },
    { href: "/ontology/ops", label: "Ops" },
  ],
  settings: [
    { href: "/settings#organization", label: "Organization" },
    { href: "/settings#team", label: "Team" },
    { href: "/settings#ai-key", label: "AI key" },
    { href: "/settings#billing", label: "Billing" },
    { href: "/settings#sessions", label: "Sessions" },
    { href: "/settings#data", label: "Data" },
  ],
} as const;
