// Per-pack E2E script (X9 E-445): signup→upload→answer→correct→brief per pack.
// Runs against staging with an owner session cookie:
//   SESSION=... BASE=https://staging... PACK=agency npx tsx scripts/e2e-pack.ts
const BASE = process.env.BASE ?? "";
const SESSION = process.env.SESSION ?? "";
const PACK = process.env.PACK === "agency" ? "agency" : "freight";

if (!BASE || !SESSION) {
  console.error("BASE + SESSION env required");
  process.exit(1);
}

const FIXTURES: Record<string, Array<{ file: string; sourceType: string }>> = {
  freight: [
    { file: "tms-week.csv", sourceType: "tms" },
    { file: "fuel-week.csv", sourceType: "fuel" },
  ],
  agency: [
    { file: "agency-video-week.csv", sourceType: "time" },
    { file: "agency-invoices.csv", sourceType: "invoice" },
  ],
};

const ANSWER_PATH = PACK === "agency" ? "project-margins" : "lane-margins";

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), Cookie: SESSION },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body };
}

async function main() {
  let pass = true;
  const check = (label: string, ok: boolean, extra = "") => {
    console.log(`${ok ? "✓" : "✗"} [${PACK}] ${label} ${extra}`);
    if (!ok) pass = false;
  };

  const { readFile } = await import("fs/promises");
  const { default: path } = await import("path");
  for (const f of FIXTURES[PACK]) {
    const bytes = await readFile(path.join(process.cwd(), "fixtures", f.file));
    const form = new FormData();
    form.set("file", new Blob([new Uint8Array(bytes)]), f.file);
    form.set("sourceType", f.sourceType);
    const up = await fetch(`${BASE}/api/uploads`, { method: "POST", headers: { Cookie: SESSION }, body: form });
    check(`upload ${f.file}`, up.ok, `status=${up.status}`);
  }

  const answer = await api(`/api/answers/${ANSWER_PATH}?week=2026-09-07`);
  const groups = (answer.body.projects ?? answer.body.lanes) as unknown[];
  check("answer", answer.status === 200 && Array.isArray(groups), `status=${answer.status} groups=${Array.isArray(groups) ? groups.length : "?"}`);

  const flag = await api("/api/corrections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targets: [], newValue: "EXCLUDE", reason: "e2e dry run" }),
  });
  check("correct (dry-run validation path)", [200, 400].includes(flag.status), `status=${flag.status}`);

  const brief = await api("/api/briefs/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ week: "2026-09-07", pack: PACK }),
  });
  check("brief", brief.status === 200, `status=${brief.status}`);

  if (!pass) process.exit(1);
  console.log(`e2e-pack [${PACK}]: ALL GREEN`);
}

main().catch((e) => {
  console.error("FATAL:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
