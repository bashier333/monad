"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import TopNav from "@/components/TopNav";
import BillingBanner from "@/components/BillingBanner";
import { getDesktopMode } from "@/components/desktop-flag";

// Marketing routes render without the product nav bar; every app route keeps
// it. In desktop (exe) mode the ontology sidebar replaces TopNav everywhere.
// Web-only routes (freight surfaces with no exe equivalent) deep-link back
// to /workspace inside the exe instead of rendering chromeless.
const HIDDEN = ["/", "/platforms", "/download", "/model"];
const WEB_ONLY = ["/dashboard", "/answers", "/upload", "/corrections", "/rules", "/briefs", "/search", "/packs", "/activity"];

export default function NavGate() {
  const pathname = usePathname();
  const router = useRouter();
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    let live = true;
    void getDesktopMode().then((d) => {
      if (live) setDesktop(d);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (desktop && WEB_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      router.replace("/workspace");
    }
  }, [desktop, pathname, router]);

  if (desktop) return null;
  if (HIDDEN.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  return (
    <>
      <BillingBanner />
      <TopNav />
    </>
  );
}
