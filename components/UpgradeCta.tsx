"use client";

import Link from "next/link";
import { trackFunnel } from "@/lib/analytics";

// Tracked upgrade link: every paywall CTA reports upgrade_clicked with its
// origin so pricing CTR is measured per surface.
export default function UpgradeCta({ from, label = "Upgrade to Team" }: { from: string; label?: string }) {
  return (
    <Link
      href="/pricing"
      onClick={() => trackFunnel("upgrade_clicked", { from })}
      className="ds-control inline-block rounded px-4 py-2 text-sm font-medium"
      style={{ background: "var(--accent)", color: "#ffffff" }}
    >
      {label}
    </Link>
  );
}
