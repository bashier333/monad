"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getDesktopMode } from "@/components/desktop-flag";
import DensityToggle from "@/components/DensityToggle";

interface RailItem {
  href: string;
  label: string;
  keys: string[];
  badge?: boolean;
}

interface RailSection {
  title: string;
  caption: string;
  items: RailItem[];
}

// Understand / Do / Decide: the rail mirrors the ontology's own three
// layers — semantic (single source of truth), kinetic (governed write-back),
// dynamic (simulations, agents, learning).
const SECTIONS: RailSection[] = [
  {
    title: "Understand",
    caption: "One shared source of truth",
    items: [
      { href: "/workspace", label: "Workspace", keys: ["workspace", "home"] },
      { href: "/ontology/twin", label: "Twin", keys: ["twin", "coverage", "risk"] },
      { href: "/ontology/explore", label: "Explore", keys: ["explore", "search", "graph"] },
      { href: "/ontology", label: "Schema", keys: ["schema", "types", "links"] },
    ],
  },
  {
    title: "Do",
    caption: "Governed write-back",
    items: [
      { href: "/ontology/actions", label: "Actions", keys: ["actions", "execute"] },
      { href: "/ontology/inbox", label: "Inbox", keys: ["inbox", "approvals"], badge: true },
    ],
  },
  {
    title: "Decide",
    caption: "Simulations, agents, learning",
    items: [
      { href: "/ontology/automations", label: "Automations", keys: ["automations", "agent"] },
      { href: "/ontology/scenarios", label: "Scenarios", keys: ["scenarios", "branches"] },
      { href: "/ontology/audit", label: "Audit", keys: ["audit", "lineage", "events"] },
      { href: "/ontology/ops", label: "Ops", keys: ["ops", "policies", "playbooks", "alerts"] },
    ],
  },
];

const ALL_ITEMS = SECTIONS.flatMap((s) => s.items);

function loadFavorites(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem("ontology-favorites") ?? "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// Exe-only workspace shell: Foundry-style left rail with universal search,
// layered navigation, live inbox badge, favorites, and theme/density.
export default function OntologyShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [desktop, setDesktop] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    let live = true;
    void getDesktopMode().then((d) => {
      if (live) setDesktop(d);
    });
    setFavorites(loadFavorites());
    return () => {
      live = false;
    };
  }, []);

  // Badge refreshes on every navigation (not once on mount) so approving
  // something doesn't leave a stale count behind.
  useEffect(() => {
    let live = true;
    fetch("/api/ontology/approvals?status=pending")
      .then((r) => (r.ok ? r.json() : { approvals: [] }))
      .then((b: { approvals?: unknown[] }) => {
        if (live) setPending(Array.isArray(b.approvals) ? b.approvals.length : 0);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [pathname]);

  function toggleFavorite(href: string) {
    setFavorites((f) => {
      const next = f.includes(href) ? f.filter((x) => x !== href) : [...f, href];
      try {
        localStorage.setItem("ontology-favorites", JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }

  if (!desktop) return <>{children}</>;

  const favItems = ALL_ITEMS.filter((i) => favorites.includes(i.href));
  const nav = (
    <nav aria-label="Ontology workspace" className="flex h-full flex-col gap-1 p-3 text-sm">
      <form
        action="/ontology/explore"
        method="get"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) router.push(`/ontology/explore?q=${encodeURIComponent(q.trim())}`);
          setMenuOpen(false);
        }}
      >
        <label htmlFor="shell-search" className="sr-only">
          Search objects
        </label>
        <input
          id="shell-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search objects…"
          autoComplete="off"
          className="w-full rounded px-3 py-2 ds-text"
          style={{ border: "1px solid var(--hairline)", background: "var(--ground)" }}
        />
      </form>
      {favItems.length > 0 && (
        <div className="mt-1">
          <p className="px-2 py-1 text-xs ds-text-2">Favorites</p>
          {favItems.map((i) => (
            <NavLink key={i.href} href={i.href} label={i.label} active={pathname === i.href} onNavigate={() => setMenuOpen(false)} />
          ))}
        </div>
      )}
      {SECTIONS.map((s) => (
        <div key={s.title} className="mt-1">
          <p className="px-2 pt-1 text-xs font-medium ds-text">{s.title}</p>
          <p className="px-2 pb-1 text-xs ds-text-2">{s.caption}</p>
          {s.items.map((i) => (
            <div key={i.href} className="flex items-center gap-1">
              <div className="flex-1">
                <NavLink
                  href={i.href}
                  label={i.label}
                  active={pathname === i.href}
                  badge={i.badge ? pending : 0}
                  onNavigate={() => setMenuOpen(false)}
                />
              </div>
              <button
                type="button"
                onClick={() => toggleFavorite(i.href)}
                aria-label={favorites.includes(i.href) ? `Remove ${i.label} from favorites` : `Add ${i.label} to favorites`}
                title={favorites.includes(i.href) ? "Remove favorite" : "Add favorite"}
                className="ds-state rounded px-1 ds-text-2"
              >
                {favorites.includes(i.href) ? "★" : "☆"}
              </button>
            </div>
          ))}
        </div>
      ))}
      <div className="mt-auto flex flex-wrap gap-2 px-1 pt-3">
        <DensityToggle />
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-[100dvh]">
      <aside className="hidden w-60 shrink-0 md:block" style={{ borderRight: "1px solid var(--hairline)" }}>{nav}</aside>
      <div className="min-w-0 flex-1">{children}</div>
      <div className="fixed bottom-4 left-4 z-40 md:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-label="Toggle workspace menu"
          className="rounded-full px-4 py-2 text-sm font-medium ds-panel"
          style={{ color: "var(--fg)" }}
        >
          Menu
        </button>
      </div>
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-label="Workspace menu">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMenuOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[70dvh] overflow-auto rounded-t-2xl ds-panel">
            {nav}
            <div className="p-3">
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="w-full rounded px-4 py-2 text-sm ds-panel ds-text"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavLink({
  href,
  label,
  active,
  badge,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  badge?: number;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className="ds-state flex items-center justify-between rounded px-2 py-1.5"
      style={
        active
          ? {
              background: "color-mix(in srgb, var(--accent) 12%, transparent)",
              color: "var(--accent)",
              fontWeight: 600,
            }
          : { color: "var(--fg)" }
      }
    >
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className="rounded-md px-1.5 text-xs font-medium"
          style={
            active
              ? { background: "var(--accent)", color: "#ffffff" }
              : { background: "var(--panel-2)", color: "var(--fg-2)" }
          }
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
