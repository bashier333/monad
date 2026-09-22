"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  Bot,
  Compass,
  Database,
  FileText,
  Flag,
  FlaskConical,
  GitBranch,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  Map,
  Network,
  Package,
  Play,
  ScrollText,
  Search,
  Settings,
  SlidersHorizontal,
  Upload,
  type LucideIcon,
} from "lucide-react";
import Bell from "@/components/Bell";
import DensityToggle from "@/components/DensityToggle";

interface RailItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: boolean;
}

interface RailSection {
  title: string;
  items: RailItem[];
}

// One navigation for web and exe. Groups mirror how operators think:
// Home for orientation, Flows for the weekly loop, Ontology for the model,
// Manage for setup. Labels name contents, never vague umbrellas.
const SECTIONS: RailSection[] = [
  {
    title: "Home",
    items: [
      { href: "/workspace", label: "Workspace", icon: LayoutDashboard },
      { href: "/search", label: "Search", icon: Search },
      { href: "/activity", label: "Activity", icon: Activity },
    ],
  },
  {
    title: "Flows",
    items: [
      { href: "/answers", label: "Answers", icon: Compass },
      { href: "/upload", label: "Upload", icon: Upload },
      { href: "/corrections", label: "Corrections", icon: Flag },
      { href: "/rules", label: "Rules", icon: SlidersHorizontal },
      { href: "/briefs", label: "Briefs", icon: FileText },
    ],
  },
  {
    title: "Ontology",
    items: [
      { href: "/ontology/board", label: "Board", icon: Map },
      { href: "/ontology/twin", label: "Twin", icon: Network },
      { href: "/ontology/explore", label: "Explore", icon: Compass },
      { href: "/ontology", label: "Schema", icon: Database },
      { href: "/ontology/actions", label: "Actions", icon: Play },
      { href: "/ontology/inbox", label: "Inbox", icon: Inbox, badge: true },
      { href: "/ontology/automations", label: "Automations", icon: Bot },
      { href: "/ontology/scenarios", label: "Scenarios", icon: GitBranch },
      { href: "/ontology/audit", label: "Audit", icon: ScrollText },
      { href: "/ontology/ops", label: "Ops", icon: Settings },
    ],
  },
  {
    title: "Manage",
    items: [
      { href: "/packs", label: "Packs", icon: Package },
      { href: "/pilots", label: "Pilots", icon: FlaskConical },
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/help", label: "Help", icon: LifeBuoy },
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

function isActive(pathname: string, href: string): boolean {
  // Schema is a sibling, not a parent: /ontology/board must not light up
  // /ontology. Other sections (answers, briefs) own their sub-pages.
  if (href === "/ontology" || href === "/workspace") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("monad-rail") === "collapsed");
    } catch {
      /* storage unavailable */
    }
    setFavorites(loadFavorites());
  }, []);

  // Pending-approval badge refreshes on every navigation so deciding
  // something never leaves a stale count behind.
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

  function toggleCollapse() {
    setCollapsed((c) => {
      try {
        localStorage.setItem("monad-rail", c ? "open" : "collapsed");
      } catch {
        /* storage unavailable */
      }
      return !c;
    });
  }

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

  const openPalette = () => window.dispatchEvent(new CustomEvent("monad:open-palette"));
  const favItems = ALL_ITEMS.filter((i) => favorites.includes(i.href));

  const nav = (
    <nav aria-label="Primary" className="flex h-full flex-col gap-1 p-3 text-sm">
      <div className="flex items-center gap-2 px-1 pb-2">
        <Link href="/workspace" className="flex min-w-0 flex-1 items-center gap-2" aria-label="Monad workspace">
          <span aria-hidden className="inline-block h-6 w-6 shrink-0 rounded-[6px]" style={{ background: "var(--accent)" }} />
          {!collapsed && <span className="truncate font-semibold tracking-tight ds-text">Monad</span>}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={toggleCollapse}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
            className="ds-state hidden rounded-md px-1.5 py-1 font-mono text-xs ds-text-2 md:block"
          >
            «
          </button>
        )}
      </div>
      {collapsed && (
        <button
          type="button"
          onClick={toggleCollapse}
          title="Expand sidebar"
          aria-label="Expand sidebar"
          className="ds-state hidden rounded-md px-1.5 py-1 font-mono text-xs ds-text-2 md:block"
        >
          »
        </button>
      )}
      <form
        action="/search"
        method="get"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
          else openPalette();
          setMenuOpen(false);
        }}
      >
        <label htmlFor="shell-search" className="sr-only">
          Search
        </label>
        {collapsed ? (
          <button
            type="button"
            onClick={openPalette}
            title="Search (Ctrl+K)"
            aria-label="Search"
            className="ds-state flex w-full items-center justify-center rounded-md border px-2 py-2 ds-text-2"
            style={{ borderColor: "var(--hairline)" }}
          >
            <Search size={15} aria-hidden />
          </button>
        ) : (
          <input
            id="shell-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={openPalette}
            placeholder="Search or ⌘K"
            autoComplete="off"
            className="w-full rounded-md border px-3 py-2 text-sm ds-text"
            style={{ borderColor: "var(--hairline)", background: "var(--panel)" }}
          />
        )}
      </form>
      {favItems.length > 0 && !collapsed && (
        <div className="mt-1">
          <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-[0.06em] ds-text-2">Favorites</p>
          {favItems.map((i) => (
            <RailLink key={i.href} item={i} active={isActive(pathname, i.href)} collapsed={false} pending={pending} onNavigate={() => setMenuOpen(false)} />
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto pb-2" style={{ scrollbarGutter: "stable" }}>
        {SECTIONS.map((s) => (
          <div key={s.title} className="mt-2">
            {!collapsed && (
              <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-[0.06em] ds-text-2">{s.title}</p>
            )}
            {s.items.map((i) => (
              <div key={i.href} className="flex items-center gap-0.5">
                <div className="min-w-0 flex-1">
                  <RailLink item={i} active={isActive(pathname, i.href)} collapsed={collapsed} pending={pending} onNavigate={() => setMenuOpen(false)} />
                </div>
                {!collapsed && (
                  <button
                    type="button"
                    onClick={() => toggleFavorite(i.href)}
                    aria-label={favorites.includes(i.href) ? `Remove ${i.label} from favorites` : `Add ${i.label} to favorites`}
                    title={favorites.includes(i.href) ? "Remove favorite" : "Add favorite"}
                    className="ds-state shrink-0 rounded px-1 text-xs ds-text-2"
                  >
                    {favorites.includes(i.href) ? "★" : "☆"}
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1 border-t px-1 pt-2" style={{ borderColor: "var(--hairline)" }}>
        <DensityToggle />
        {!collapsed && <Bell />}
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-[100dvh]">
      <aside
        className={`sticky top-0 hidden h-[100dvh] shrink-0 md:block ${collapsed ? "w-16" : "w-60"}`}
        style={{ borderRight: "1px solid var(--hairline)", background: "var(--panel)" }}
      >
        {nav}
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
      <div className="fixed bottom-4 left-4 z-40 md:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-label="Toggle navigation menu"
          className="rounded-full px-4 py-2 text-sm font-medium ds-panel"
          style={{ color: "var(--fg)" }}
        >
          Menu
        </button>
      </div>
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-label="Navigation menu">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMenuOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[70dvh] overflow-auto rounded-t-2xl ds-panel">
            {nav}
            <div className="p-3">
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="w-full rounded-md px-4 py-2 text-sm ds-panel ds-text"
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

function RailLink({
  item,
  active,
  collapsed,
  pending,
  onNavigate,
}: {
  item: RailItem;
  active: boolean;
  collapsed: boolean;
  pending: number;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  const count = item.badge ? pending : 0;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className="ds-state flex items-center gap-2.5 rounded-md px-2 py-1.5"
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
      <Icon size={16} aria-hidden className="shrink-0" />
      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
      {!collapsed && count > 0 && (
        <span
          className="rounded-md px-1.5 text-xs font-medium"
          style={
            active
              ? { background: "var(--accent)", color: "#ffffff" }
              : { background: "var(--panel-2)", color: "var(--fg-2)" }
          }
        >
          {count}
        </span>
      )}
    </Link>
  );
}
