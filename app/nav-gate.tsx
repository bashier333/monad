"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import BillingBanner from "@/components/BillingBanner";
import { getDesktopMode } from "@/components/desktop-flag";

// Marketing routes render without product chrome. Every app route renders
// inside one shared sidebar shell on web and exe alike, so navigation never
// forks by platform. Web-only routes (freight surfaces with no exe
// equivalent) deep-link back to /workspace inside the exe.
const HIDDEN = ["/", "/platforms", "/download", "/model"];
const WEB_ONLY = ["/dashboard", "/answers", "/upload", "/corrections", "/rules", "/briefs", "/search", "/packs", "/activity"];

export default function NavGate({ children }: { children: React.ReactNode }) {
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

  if (HIDDEN.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return <>{children}</>;
  return (
    <AppShell>
      <BillingBanner />
      <div id="main" tabIndex={-1}>
        {children}
      </div>
    </AppShell>
  );
}
