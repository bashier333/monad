import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import { Suspense } from "react";
import Script from "next/script";
import NavGate from "@/app/nav-gate";
import VitalsReporter from "@/components/VitalsReporter";
import CommandPalette from "@/components/CommandPalette";
import { Toaster } from "sonner";
import { isDesktopMode } from "@/lib/core/desktop";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: "Monad",
  description: "National AI infrastructure built for every operational strategic execution.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark light",
};

const THEME_BOOTSTRAP = `(function(){try{var d=document.documentElement;var t=localStorage.getItem("monad-theme");if(t==="dark")d.classList.add("dark");else if(t==="light")d.classList.remove("dark");var n=localStorage.getItem("monad-density");if(n==="compact")d.setAttribute("data-density","compact");}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const desktop = isDesktopMode();
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable}${desktop ? " dark" : ""}`} suppressHydrationWarning>
      <body>
        <Script id="monad-theme-init" strategy="beforeInteractive">
          {THEME_BOOTSTRAP}
        </Script>
        <noscript>
          <style>{`[data-motion] { opacity: 1 !important; transform: none !important; }`}</style>
        </noscript>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:bg-white focus:p-2 focus:underline">
          Skip to content
        </a>
        <Suspense fallback={null}>
          <NavGate />
        </Suspense>
        <VitalsReporter />
        <CommandPalette />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
