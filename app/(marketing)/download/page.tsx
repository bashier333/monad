import type { Metadata } from "next";
import Link from "next/link";
import { JetBrains_Mono } from "next/font/google";
import DownloadForm from "./form";
import Reveal from "../../reveal";
import { APP_VERSION } from "@/lib/core/version";

// Monochrome marketing: transparent ground over the shared video backdrop,
// tabular numerals, one blue accent. Surfaces 16px, controls full-pill.
const mono = JetBrains_Mono({ subsets: ["latin"], display: "swap", weight: ["500", "700"] });

export const metadata: Metadata = {
  title: "Download Monad",
  description: "Live public-records checks on your own machine. Private build.",
};

const BUILDS = [
  { os: "macOS", arch: "Apple Silicon and Intel", status: "On request" },
  { os: "Windows", arch: "64-bit", status: "Available now" },
  { os: "Linux", arch: "64-bit", status: "On request" },
];

export default function DownloadPage() {
  return (
    <main className="ds-text">
      <style>{`
        ::selection { background: var(--accent); color: #ffffff; }
        :focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 6px; }
        input { caret-color: var(--accent); }
        .rv { opacity: 0; transform: translateY(26px); transition: opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1); }
        .rv.in { opacity: 1; transform: none; }
        .cta-lift { transition: transform 0.2s cubic-bezier(0.16,1,0.3,1), background-color 0.2s; }
        .cta-lift:active { transform: translateY(1px) scale(0.98); }
        @media (prefers-reduced-motion: reduce) {
          .rv { opacity: 1; transform: none; transition: none; }
        }
      `}</style>
      <noscript>
        <style>{`.rv { opacity: 1 !important; transform: none !important; }`}</style>
      </noscript>

      <section className="mx-auto max-w-7xl px-4 pb-14 pt-16 text-center md:px-8 md:pt-24">
        <Reveal>
          <h1 className="mx-auto max-w-[20ch] text-balance text-5xl font-bold leading-[1.04] tracking-tight md:text-7xl">
            Take Monad home.
          </h1>
          <p className="mx-auto mt-6 max-w-[54ch] text-[17px] leading-relaxed ds-text-2">
            Autonomous AI infrastructure, on your own machine. Windows installer ships today; macOS and Linux on request.
          </p>
          <div className="mt-8">
            <a
              href="/api/download/exe"
              download
              className="cta-lift inline-block whitespace-nowrap rounded-full px-8 py-3.5 text-[16px] font-bold text-white"
              style={{ background: "var(--accent)" }}
            >
              Download for Windows
            </a>
            <p className={`${mono.className} mt-4 text-xs ds-text-2`}>Version {APP_VERSION} · Windows 64-bit (<Link href="/changelog" className="underline">what&apos;s new</Link>)</p>
            <p className="mx-auto mt-3 max-w-[44ch] text-xs leading-relaxed ds-text-2">
              Guided installer for Windows 64-bit — no admin needed, installs for your user account with
              Start Menu and desktop shortcuts. First launch creates its own local database; nothing to configure.
            </p>
          </div>
        </Reveal>
        <Reveal delay={120} className="mx-auto mt-10 grid max-w-4xl gap-4 text-left md:grid-cols-3">
          {BUILDS.map((b) => (
            <div key={b.os} className="rounded-2xl border  ds-panel p-5">
              <p className="text-lg font-bold">{b.os}</p>
              <p className="mt-1 text-sm ds-text-2">{b.arch}</p>
              <p className={`${mono.className} mt-3 text-xs ds-text-2`}>{b.status}</p>
            </div>
          ))}
        </Reveal>
        <Reveal delay={160} className="mx-auto mt-10 max-w-md text-left">
          <DownloadForm />
        </Reveal>
      </section>

    </main>
  );
}
