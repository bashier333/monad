import type { Metadata } from "next";
import TopNav from "@/components/TopNav";
import VitalsReporter from "@/components/VitalsReporter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Decision Layer",
  description: "Which lanes made money this week, and why.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TopNav />
        <VitalsReporter />
        {children}
      </body>
    </html>
  );
}
