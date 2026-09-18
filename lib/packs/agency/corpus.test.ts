import { readFileSync } from "fs";
import path from "path";
import { applyMapping, detectColumns } from "@/lib/core/ingest/columns";
import { parseBuffer } from "@/lib/core/ingest/parse";
import { computeProjectMargins } from "@/lib/packs/agency/engine";
import { AGENCY_ALIASES, AGENCY_FIELDS } from "@/lib/packs/agency/fields";
import { validateAgencyRow } from "@/lib/packs/agency/validate";
import { describe, expect, it } from "vitest";

function load(name: string): Buffer {
  return readFileSync(path.join(process.cwd(), "fixtures", name));
}

function runPipeline(name: string, sourceType: string) {
  const { headers, rows } = parseBuffer(name, load(name));
  const { mapping } = detectColumns(headers, AGENCY_FIELDS, AGENCY_ALIASES);
  const mapped = applyMapping(headers, rows, mapping, AGENCY_FIELDS);
  const opts = sourceType;
  const seen = new Set<string>();
  let ok = 0;
  const codes: string[] = [];
  for (const { record } of mapped) {
    const issues = validateAgencyRow(record, seen, opts);
    if (issues.length === 0) ok++;
    else codes.push(...issues.map((i) => i.code));
  }
  return { headers, total: mapped.length, ok, quarantined: mapped.length - ok, codes, mapping };
}

describe("agency fixture corpus (X4)", () => {
  it("time fixture: 3 rows, all valid, project/hours mapped", () => {
    const r = runPipeline("agency-time.csv", "time");
    expect(r.total).toBe(3);
    expect(r.ok).toBe(3);
    expect(r.mapping.project).toBeDefined();
    expect(r.mapping.hours).toBeDefined();
  });

  it("messy fixture: missing project, bad date, negative hours quarantined", () => {
    const r = runPipeline("agency-messy.csv", "time");
    expect(r.total).toBe(4);
    expect(r.ok).toBe(1);
    expect(r.codes).toContain("REQUIRED");
    expect(r.codes).toContain("INVALID_DATE");
    expect(r.codes).toContain("NEGATIVE_VALUE");
  });

  it("unicode fixture parses cleanly", () => {
    const r = runPipeline("agency-unicode.csv", "time");
    expect(r.total).toBe(2);
    expect(r.ok).toBe(2);
  });

  it("revision/approval/invoice/project fixtures parse with headers", () => {
    for (const [f, type] of [
      ["agency-revisions.csv", "revision"],
      ["agency-approvals.csv", "approval"],
      ["agency-invoices.csv", "invoice"],
      ["agency-projects.csv", "project"],
      ["agency-rates.csv", "rate"],
    ] as const) {
      const { headers, rows } = parseBuffer(f, load(f));
      expect(rows.length, f).toBeGreaterThan(0);
      expect(headers.length, f).toBeGreaterThanOrEqual(2);
      void type;
    }
  });

  it("approval fixture maps sent/signed and validates (E-153/E-168)", () => {
    const r = runPipeline("agency-approvals.csv", "approval");
    expect(r.mapping.project).toBeDefined();
    expect(r.mapping.sentDate).toBeDefined();
    expect(r.mapping.signedDate).toBeDefined();
    expect(r.ok).toBe(2);
  });

  it("out-of-order approval (signed before sent) quarantines with APPROVAL_ORDER", () => {
    const { headers, rows } = parseBuffer("agency-approvals.csv", load("agency-approvals.csv"));
    const { mapping } = detectColumns(headers, AGENCY_FIELDS, AGENCY_ALIASES);
    const mapped = applyMapping(headers, rows, mapping, AGENCY_FIELDS);
    const seen = new Set<string>();
    const rec = { ...mapped[0].record, signedDate: "2026-09-01", sentDate: "2026-09-08" };
    expect(validateAgencyRow(rec, seen, "approval").map((i) => i.code)).toContain("APPROVAL_ORDER");
  });

  it("round jump R1→R3 quarantines with ROUND_GAP; sequential R1→R2 passes", () => {
    const seen = new Set<string>();
    const base = { project: "Gap", date: "2026-09-07", person: "Al", task: "edit", hours: "1" } as Record<
      (typeof AGENCY_FIELDS)[number],
      string
    >;
    const full = (round: string) =>
      ({ ...Object.fromEntries(AGENCY_FIELDS.map((f) => [f, ""])), ...base, round }) as Record<
        (typeof AGENCY_FIELDS)[number],
        string
      >;
    expect(validateAgencyRow(full("R1"), seen, "revision")).toEqual([]);
    expect(validateAgencyRow(full("R2"), seen, "revision")).toEqual([]);
    expect(validateAgencyRow(full("R4"), seen, "revision").map((i) => i.code)).toContain("ROUND_GAP");
  });

  it("feedback + asset fixtures parse and validate (E-157/E-158)", () => {
    const fb = runPipeline("agency-feedback.csv", "feedback");
    expect(fb.total).toBe(3);
    expect(fb.ok).toBe(3);
    expect(fb.mapping.round).toBeDefined();
    const assets = runPipeline("agency-assets.csv", "asset");
    expect(assets.total).toBe(3);
    expect(assets.ok).toBe(3);
    expect(assets.mapping.asset).toBeDefined();
  });

  it("video-shop week + design week fixtures validate (E-171/E-172)", () => {
    const week = runPipeline("agency-video-week.csv", "time");
    expect(week.total).toBe(12);
    expect(week.ok).toBe(12);
    const design = runPipeline("agency-design.csv", "time");
    expect(design.total).toBe(6);
    expect(design.ok).toBe(6);
  });

  it("all-null-hours fixture fully quarantines via REQUIRED (E-175)", () => {
    const r = runPipeline("agency-null-hours.csv", "time");
    expect(r.total).toBe(2);
    expect(r.ok).toBe(0);
    expect(r.codes).toContain("REQUIRED");
  });

  it("future fixture validates ok but engine excludes it from the week (E-176)", () => {
    const r = runPipeline("agency-future.csv", "time");
    expect(r.ok).toBe(2);
    const { headers, rows } = parseBuffer("agency-future.csv", load("agency-future.csv"));
    const { mapping } = detectColumns(headers, AGENCY_FIELDS, AGENCY_ALIASES);
    const mapped = applyMapping(headers, rows, mapping, AGENCY_FIELDS);
    const result = computeProjectMargins(
      mapped.map((m, i) => ({
        recordKey: `F${i}`,
        date: m.record.date,
        project: m.record.project,
        client: "",
        person: m.record.person,
        task: m.record.task,
        hours: m.record.hours,
        rate: m.record.rate,
        revenue: "",
        runId: "run-f",
        fileName: "agency-future.csv",
        rowNumber: m.rowNumber,
      })),
      [],
      [],
      [],
      new Map(),
      [],
      "2026-09-07",
      "2026-09-13",
    );
    expect(result.projects).toEqual([]);
  });

  it("duplicate-everything fixture keeps 1, flags rest (E-177)", () => {
    const r = runPipeline("agency-dups.csv", "time");
    expect(r.total).toBe(3);
    expect(r.ok).toBe(1);
    expect(r.codes.filter((c) => c === "DUPLICATE_KEY")).toHaveLength(2);
  });

  it("footer-totals row skipped at parse and counted (E-178)", () => {
    const { rows, skipped } = parseBuffer("agency-footers.csv", load("agency-footers.csv"));
    expect(rows).toHaveLength(3);
    expect(skipped.some((s) => /footer/i.test(s.reason))).toBe(true);
    const r = runPipeline("agency-footers.csv", "time");
    expect(r.total).toBe(3);
    expect(r.ok).toBe(3);
  });

  it("5k-row week validates fast enough for perf sanity (E-179)", () => {
    const headers = ["Project", "Date", "Person", "Task", "Hours", "Rate"];
    const rows: string[][] = [];
    for (let i = 0; i < 5000; i++) {
      rows.push([`P${i % 50}`, "2026-09-07", `Person${i % 20}`, `task${i}`, "2", "100"]);
    }
    const { mapping } = detectColumns(headers, AGENCY_FIELDS, AGENCY_ALIASES);
    const mapped = applyMapping(headers, rows, mapping, AGENCY_FIELDS);
    const seen = new Set<string>();
    const t0 = Date.now();
    let ok = 0;
    for (const { record } of mapped) {
      if (validateAgencyRow(record, seen, "time").length === 0) ok++;
    }
    expect(Date.now() - t0).toBeLessThan(5000);
    expect(ok).toBe(5000);
  });

  it("latin-1 decodes humanely; replacement chars quarantine with ENCODING (E-159/E-160)", () => {
    const latin = parseBuffer("latin1.csv", Buffer.from("Project,Date,Person,Task,Hours\nCaf\xe9,2026-09-07,Al,edit,2\n", "latin1"));
    expect(latin.encoding).toBe("latin-1");
    const { mapping } = detectColumns(latin.headers, AGENCY_FIELDS, AGENCY_ALIASES);
    const mapped = applyMapping(latin.headers, latin.rows, mapping, AGENCY_FIELDS);
    expect(mapped[0].record.project).toBe("Café");
    expect(validateAgencyRow(mapped[0].record, new Set<string>(), "time")).toEqual([]);
    const bad = { ...mapped[0].record, task: "ed�it" };
    expect(validateAgencyRow(bad, new Set<string>(), "time").map((i) => i.code)).toContain("ENCODING");
    const bom = parseBuffer("bom.csv", Buffer.from("﻿Project,Date,Hours\nA,2026-09-07,2\n", "utf8"));
    const bomMap = detectColumns(bom.headers, AGENCY_FIELDS, AGENCY_ALIASES);
    expect(bomMap.mapping.project).toBeDefined();
  });
});
