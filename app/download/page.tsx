import type { Metadata } from "next";
import Link from "next/link";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import DownloadForm from "./form";
import Reveal from "../reveal";
import { APP_VERSION } from "@/lib/core/version";

// World: light manifesto instrument. Stone-50 ground, hairline borders,
// tabular numerals, one signal emerald. Surfaces 16px, controls full-pill.
const sans = Space_Grotesk({ subsets: ["latin"], display: "swap", weight: ["500", "600", "700"] });
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
    <main className={`${sans.className} bg-stone-50 text-stone-900`}>
      <style>{`
        ::selection { background: #047857; color: #ffffff; }
        :focus-visible { outline: 2px solid #047857; outline-offset: 3px; border-radius: 6px; }
        input { caret-color: #047857; }
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

      <header className="border-b border-stone-200">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
          <Link href="/" className="text-[17px] font-bold tracking-tight">
            Monad
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 pb-14 pt-16 text-center md:px-8 md:pt-24">
        <Reveal>
          <h1 className="mx-auto max-w-[20ch] text-balance text-5xl font-bold leading-[1.04] tracking-tight md:text-7xl">
            Take Monad home.
          </h1>
          <p className="mx-auto mt-6 max-w-[54ch] text-[17px] leading-relaxed text-stone-600">
            One live model of the business, on your own machine. Windows installer ships today; macOS and Linux on request.
          </p>
          <div className="mt-8">
            <a
              href="/api/download/exe"
              download
              className="cta-lift inline-block whitespace-nowrap rounded-full bg-emerald-700 px-8 py-3.5 text-[16px] font-bold text-white hover:bg-emerald-800"
            >
              Download for Windows
            </a>
            <p className={`${mono.className} mt-4 text-xs text-stone-500`}>Version {APP_VERSION} · Windows 64-bit (<Link href="/changelog" className="underline">what&apos;s new</Link>)</p>
            <p className="mx-auto mt-3 max-w-[44ch] text-xs leading-relaxed text-stone-500">
              Guided installer for Windows 64-bit — no admin needed, installs for your user account with
              Start Menu and desktop shortcuts. First launch creates its own local database; nothing to configure.
            </p>
          </div>
        </Reveal>
        <Reveal delay={120} className="mx-auto mt-10 grid max-w-4xl gap-4 text-left md:grid-cols-3">
          {BUILDS.map((b) => (
            <div key={b.os} className="rounded-2xl border border-stone-200 bg-white p-5">
              <p className="text-lg font-bold">{b.os}</p>
              <p className="mt-1 text-sm text-stone-600">{b.arch}</p>
              <p className={`${mono.className} mt-3 text-xs text-stone-500`}>{b.status}</p>
            </div>
          ))}
        </Reveal>
        <Reveal delay={160} className="mx-auto mt-10 max-w-md text-left">
          <DownloadForm />
        </Reveal>
      </section>

      <footer className="border-t border-stone-200">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-stone-500 md:px-8">
          <p>Monad. One model. One line.</p>
          <Link href="/" className="transition-colors hover:text-stone-900">
            Back to overview
          </Link>
        </div>
      </footer>
    </main>
  );
}
