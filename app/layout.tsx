import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import { Suspense } from "react";
import Script from "next/script";
import NavGate from "@/app/nav-gate";
import VitalsReporter from "@/components/VitalsReporter";
import CommandPalette from "@/components/CommandPalette";
import { Toaster } from "sonner";
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
  colorScheme: "dark",
};

// Dark-only product: the .dark class is server-rendered unconditionally.
// The bootstrap keeps only the density preference; the old monad-theme
// light preference is ignored on purpose.
const DENSITY_BOOTSTRAP = `(function(){try{var n=localStorage.getItem("monad-density");if(n==="compact")document.documentElement.setAttribute("data-density","compact");}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable} dark`} suppressHydrationWarning>
      <body>
        <Script id="monad-density-init" strategy="beforeInteractive">
          {DENSITY_BOOTSTRAP}
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
