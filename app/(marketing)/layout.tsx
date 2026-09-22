import { Space_Grotesk } from "next/font/google";
import LandingBackground from "@/components/LandingBackground";
import { MarketingFooter, MarketingHeader } from "@/components/MarketingChrome";

// Marketing shell: every public page shares the video backdrop, the
// grotesk display voice for headings, and a readability veil. App routes
// keep the solid console theme — video never sits behind data tables.
const display = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${display.variable} mkt`}>
      <style>{`
        .mkt h1, .mkt h2 { font-family: var(--font-display), var(--font-sans), system-ui, sans-serif; letter-spacing: -0.02em; }
      `}</style>
      <LandingBackground />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{ background: "color-mix(in srgb, var(--ground) 32%, transparent)" }}
      />
      <MarketingHeader />
      <div className="relative">{children}</div>
      <MarketingFooter />
    </div>
  );
}
