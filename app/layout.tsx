import type { Metadata } from "next";
import TopNav from "@/components/TopNav";
import VitalsReporter from "@/components/VitalsReporter";
import CommandPalette from "@/components/CommandPalette";
import "./globals.css";

export const metadata: Metadata = {
  title: "Decision Layer",
  description: "Which lanes made money this week, and why.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:bg-white focus:p-2 focus:underline">
          Skip to content
        </a>
        <TopNav />
        <VitalsReporter />
        <CommandPalette />
        <div id="main">{children}</div>
      </body>
    </html>
  );
}
