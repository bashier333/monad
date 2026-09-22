import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import Reveal from "../../../reveal";

// World: light manifesto instrument. Stone-50 ground, hairline borders,
// tabular numerals, one signal emerald. Surfaces 16px, controls full-pill.
const sans = Space_Grotesk({ subsets: ["latin"], display: "swap", weight: ["500", "600", "700"] });
const mono = JetBrains_Mono({ subsets: ["latin"], display: "swap", weight: ["500", "700"] });

export const metadata: Metadata = {
  title: "Ontology - Monad",
  description:
    "An integrated operational architecture that unifies system data, strategic rules, real-world execution, and access controls to power autonomous business workflows.",
};

const MONO = mono.style.fontFamily;
const SANS = sans.style.fontFamily;

const STROKE = "var(--fg-2)";
const FAINT = "var(--fg-2)";
const INK = "var(--fg)";

function ObjectBox({ x, y }: { x: number; y: number }) {
  const rows = [
    { g: "\u2261", t: "Properties" },
    { g: "fx", t: "Functions" },
    { g: "\u2692", t: "Actions" },
    { g: "\u26A1", t: "Automations" },
  ];
  return (
    <g>
      <rect x={x} y={y} width={180} height={124} rx={5} fill="var(--panel)" stroke={STROKE} strokeWidth={1} />
      <text x={x + 90} y={y + 22} textAnchor="middle" fontSize={16} fontWeight={700} fill={INK} style={{ fontFamily: SANS }}>
        OBJECT
      </text>
      <line x1={x} y1={y + 34} x2={x + 180} y2={y + 34} stroke={STROKE} strokeWidth={1} />
      {rows.map((r, i) => {
        const cy = y + 34 + 22.5 * (i + 0.5);
        return (
          <g key={r.t}>
            {i > 0 && <line x1={x} y1={y + 34 + 22.5 * i} x2={x + 180} y2={y + 34 + 22.5 * i} stroke="var(--hairline)" strokeWidth={1} />}
            <text x={x + 16} y={cy + 5} fontSize={14} fill={INK} style={{ fontFamily: MONO }}>
              <tspan fill={STROKE}>{r.g}</tspan>
              {`  ${r.t}`}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function LinkPill({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x - 27} y={y - 12} width={54} height={24} rx={12} fill="var(--panel)" stroke={STROKE} strokeWidth={1} />
      <text x={x} y={y + 4} textAnchor="middle" fontSize={12} fill={INK} style={{ fontFamily: MONO }}>
        Link
      </text>
    </g>
  );
}

function Icosahedron({ cx, cy }: { cx: number; cy: number }) {
  const s = 30;
  const p = (dx: number, dy: number) => `${cx + dx},${cy + dy}`;
  const hex = [
    [0, -s],
    [0.866 * s, -0.5 * s],
    [0.866 * s, 0.5 * s],
    [0, s],
    [-0.866 * s, 0.5 * s],
    [-0.866 * s, -0.5 * s],
  ];
  const tri = [
    [0, -0.6 * s],
    [0.52 * s, 0.3 * s],
    [-0.52 * s, 0.3 * s],
  ];
  return (
    <g stroke={INK} strokeWidth={1} fill="none">
      <polygon points={hex.map((v) => p(v[0], v[1])).join(" ")} />
      <polygon points={tri.map((v) => p(v[0], v[1])).join(" ")} />
      <line x1={cx} y1={cy - s} x2={cx} y2={cy - 0.6 * s} />
      <line x1={cx + 0.866 * s} y1={cy - 0.5 * s} x2={cx} y2={cy - 0.6 * s} />
      <line x1={cx + 0.866 * s} y1={cy + 0.5 * s} x2={cx + 0.52 * s} y2={cy + 0.3 * s} />
      <line x1={cx} y1={cy + s} x2={cx + 0.52 * s} y2={cy + 0.3 * s} />
      <line x1={cx} y1={cy + s} x2={cx - 0.52 * s} y2={cy + 0.3 * s} />
      <line x1={cx - 0.866 * s} y1={cy + 0.5 * s} x2={cx - 0.52 * s} y2={cy + 0.3 * s} />
      <line x1={cx - 0.866 * s} y1={cy - 0.5 * s} x2={cx} y2={cy - 0.6 * s} />
    </g>
  );
}

function ObjectDiagram() {
  const cols = [190, 510, 830];
  const rows = [76, 318, 556];
  return (
    <svg viewBox="0 0 1200 760" className="w-full" role="img" aria-label="Diagram of linked objects around one ontology">
      <rect x={60} y={24} width={1080} height={712} rx={10} fill="var(--panel)" stroke={STROKE} strokeWidth={1} />
      <g stroke={FAINT} strokeWidth={1} strokeDasharray="4 4">
        <line x1={600} y1={200} x2={600} y2={296} />
        <line x1={600} y1={464} x2={600} y2={556} />
        <line x1={280} y1={200} x2={280} y2={318} />
        <line x1={920} y1={200} x2={920} y2={318} />
        <line x1={280} y1={442} x2={280} y2={556} />
        <line x1={920} y1={442} x2={920} y2={556} />
      </g>
      <g stroke={STROKE} strokeWidth={1}>
        <line x1={370} y1={138} x2={510} y2={138} />
        <line x1={690} y1={138} x2={830} y2={138} />
        <line x1={370} y1={380} x2={505} y2={380} />
        <line x1={695} y1={380} x2={830} y2={380} />
        <line x1={370} y1={618} x2={510} y2={618} />
        <line x1={690} y1={618} x2={830} y2={618} />
      </g>
      {cols.map((x) =>
        rows.map((y) => (
          <ObjectBox key={`${x}-${y}`} x={x} y={y} />
        )),
      )}
      <rect x={505} y={296} width={190} height={168} rx={5} fill="var(--panel)" stroke={STROKE} strokeWidth={1} />
      <Icosahedron cx={600} cy={352} />
      <text x={600} y={434} textAnchor="middle" fontSize={20} fontWeight={700} letterSpacing={2} fill={INK} style={{ fontFamily: SANS }}>
        ONTOLOGY
      </text>
      <LinkPill x={440} y={138} />
      <LinkPill x={760} y={138} />
      <LinkPill x={440} y={380} />
      <LinkPill x={760} y={380} />
      <LinkPill x={440} y={618} />
      <LinkPill x={760} y={618} />
    </svg>
  );
}

const DOCS = [
  { n: "DOC 01" },
  { n: "DOC 02" },
  { n: "DOC 03" },
];

export default function OntologyPage() {
  return (
    <main className={`${sans.className} ds-text`}>
      <style>{`
        ::selection { background: var(--accent); color: #ffffff; }
        :focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 6px; }
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

      <section className="overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-16 text-center md:px-8 md:pt-24">
          <Reveal>
            <h1 className="mx-auto max-w-[16ch] text-balance text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
              Ontology
            </h1>
            <p className="mx-auto mt-6 max-w-[58ch] text-[17px] leading-relaxed ds-text-2">
              An integrated operational architecture that unifies system data, strategic rules, real-world
              execution, and access controls to power autonomous business workflows.
            </p>
            <div className="mt-8">
              <a
                href="/api/download/exe"
                download
                className="cta-lift inline-block whitespace-nowrap rounded-full px-7 py-3 text-[16px] font-bold text-white"
                style={{ background: "var(--accent)" }}
              >
                Download for Windows
              </a>
              <p className="mx-auto mt-3 max-w-[40ch] text-xs leading-relaxed ds-text-2">
                Zip file. Extract it, then run Monad Ontology.exe inside the folder.
              </p>
            </div>
          </Reveal>
          <Reveal delay={140} className="mx-auto mt-12 max-w-5xl">
            <video
              src="/videos/monad-motherboard.mp4"
              autoPlay
              muted
              loop
              playsInline
              className="w-full rounded-2xl border object-cover"
            />
          </Reveal>
        </div>
      </section>

      <section className="border-t">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center md:px-8 md:py-24">
          <Reveal>
            <p className="text-[15px] font-semibold tracking-wide ds-text-2">Ontology Engine</p>
            <h2 className="mx-auto mt-4 max-w-[30ch] text-balance text-3xl font-medium leading-snug tracking-tight md:text-4xl">
              <span className="font-bold">Coordinate complex operational workflows</span> across the entire
              enterprise.
            </h2>
          </Reveal>
          <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-3">
            {DOCS.map((d, i) => (
              <Reveal key={d.n} delay={i * 80}>
                <div className="h-full rounded-2xl border ds-panel p-6 text-left">
                  <p className={`${mono.className} text-xs ds-text-2`}>{d.n}</p>
                  <div className="mt-4 h-2 w-3/4 rounded-full ds-panel-2" />
                  <div className="mt-2 h-2 w-1/2 rounded-full ds-panel-2" />
                  <p className="mt-4 text-[13px] ds-text-2">Placeholder</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t">
        <div className="mx-auto max-w-5xl px-4 py-16 md:px-8 md:py-24">
          <Reveal>
            <ObjectDiagram />
          </Reveal>
          <Reveal delay={120}>
            <p className="mx-auto mt-10 max-w-[58ch] text-center text-[16px] leading-relaxed ds-text-2">
              Objects hold the properties, functions, actions, and automations of the business. Links bind them into
              one model that drives decisions across the enterprise.
            </p>
          </Reveal>
        </div>
      </section>

    </main>
  );
}
