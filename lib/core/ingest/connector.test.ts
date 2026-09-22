import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import {
  CONNECTOR_KEYS,
  connectorFreshness,
  connectorTypeKey,
  fetchWithRetry,
  flagUnusedConnectors,
  freshnessBadge,
  getConnector,
  isConnectorKey,
  listConnectors,
  memoryConnectorStore,
  parseConnectorConfig,
  previewConnectorPull,
  requireConnectorSecrets,
  checkConnectorSecrets,
  rowsToCsv,
  rpmWindowMs,
  runConnectorPull,
  scrubPIIRow,
  validateConnectorRow,
  type ConnectorDefinition,
  type FetchImpl,
} from "./connector";
import "./connectors";
import { findConflicts } from "./merge";

const ORG = "org-test-1";

function csvConfig(key: string, text: string, extra: Record<string, unknown> = {}) {
  return { key, organizationId: ORG, sourceText: text, ...extra };
}

function okFetch(text: string, status = 200): FetchImpl {
  return async () => ({ status, text: async () => text });
}

describe("connector registry (all 15 present)", () => {
  it("registers every key with label, kind, rpm and sla", () => {
    expect(listConnectors()).toHaveLength(15);
    for (const k of CONNECTOR_KEYS) {
      const d = getConnector(k);
      expect(d, k).not.toBeNull();
      expect(d!.label.length).toBeGreaterThan(0);
      expect(d!.defaultRpm).toBeGreaterThan(0);
      expect(d!.freshnessSlaMs).toBeGreaterThan(0);
    }
    expect(getConnector("nope")).toBeNull();
    expect(isConnectorKey("csv-upload")).toBe(true);
    expect(isConnectorKey("nope")).toBe(false);
    expect(connectorTypeKey("csv-upload")).toBe("conn_csv_upload");
  });
});

describe("config schema (F2-00001 family)", () => {
  it("accepts a valid config", () => {
    const r = parseConnectorConfig(csvConfig("csv-upload", "a,b\n1,2"));
    expect(r.ok).toBe(true);
    expect(r.config?.key).toBe("csv-upload");
  });
  it("rejects unknown key with a field error", () => {
    const r = parseConnectorConfig({ key: "teleport", organizationId: ORG });
    expect(r.ok).toBe(false);
    expect(r.issues?.[0].field).toBe("key");
  });
  it("rejects missing organizationId with a field error", () => {
    const r = parseConnectorConfig({ key: "csv-upload" });
    expect(r.ok).toBe(false);
    expect(r.issues?.some((i) => i.field === "organizationId")).toBe(true);
  });
  it("fails the pull (never throws) on key/definition mismatch", async () => {
    const store = memoryConnectorStore();
    const def = getConnector("csv-upload")!;
    const s = await runConnectorPull(def, csvConfig("xlsx-upload", "a\n1"), { store });
    expect(s.status).toBe("FAILED");
    expect(s.failureReason).toMatch(/does not match/);
  });
});

describe("csv pull + validation + quarantine", () => {
  const csv = "LoadID,PickupDate,Miles,Revenue\nL1,2026-09-01,120,400\nL2,not-a-date,50,100\nL3,2026-09-02,-10,200";
  it("lands typed rows; bad date + negative miles quarantined, never dropped silently", async () => {
    const store = memoryConnectorStore();
    const s = await runConnectorPull(getConnector("csv-upload")!, csvConfig("csv-upload", csv), { store });
    expect(s.status).toBe("COMPLETED");
    expect(s.rowsPulled).toBe(3);
    expect(s.rowsUpserted).toBe(1);
    expect(s.rowsQuarantined).toBe(2);
    expect(s.rowErrors.map((e) => e.code).sort()).toEqual(["INVALID_DATE", "NEGATIVE_VALUE"]);
    expect(store.objects.size).toBe(1);
  });
  it("validateConnectorRow flags encoding + missing key", () => {
    expect(validateConnectorRow({ key: "", fields: {} }, 1).some((i) => i.code === "MISSING_KEY")).toBe(true);
    expect(
      validateConnectorRow({ key: "k", fields: { note: "bad � char" } }, 1).some((i) => i.code === "ENCODING"),
    ).toBe(true);
  });
});

describe("xlsx pull (real workbook bytes)", () => {
  it("parses a generated xlsx payload", async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["LoadID", "Miles"], ["X1", "42"]]), "Sheet1");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const store = memoryConnectorStore();
    const s = await runConnectorPull(
      getConnector("xlsx-upload")!,
      { key: "xlsx-upload", organizationId: ORG, sourceText: buf.toString("base64"), sourceEncoding: "base64" },
      { store },
    );
    expect(s.status).toBe("COMPLETED");
    expect(s.rowsPulled).toBe(1);
  });
});

describe("rest pagination + incremental cursor", () => {
  const pages: Record<string, { rows: Array<Record<string, unknown>>; nextCursor: string | null }> = {
    "": { rows: [{ _key: "r1", _date: "2026-09-01", miles: "10" }], nextCursor: "p2" },
    p2: { rows: [{ _key: "r2", _date: "2026-09-02", miles: "20" }], nextCursor: null },
  };
  const fetch: FetchImpl = async (url) => {
    const u = new URL(url);
    const c = u.searchParams.get("cursor") ?? "";
    return { status: 200, text: async () => JSON.stringify(pages[c] ?? { rows: [], nextCursor: null }) };
  };
  it("second pull resumes from the stored cursor and fetches only new rows", async () => {
    const store = memoryConnectorStore();
    const def = getConnector("rest-paginated")!;
    const cfg = { key: "rest-paginated", organizationId: ORG, endpoint: "https://example.test/api" };
    const first = await runConnectorPull(
      { ...def, pull: async (ctx) => {
        const fetched = await ctx.fetchImpl("https://example.test/api" + (ctx.cursor ? `?cursor=${ctx.cursor}` : ""));
        const body = JSON.parse(await fetched.text()) as { rows: Array<Record<string, unknown>>; nextCursor: string | null };
        return { rows: body.rows.map((r, i) => ({ key: String(r._key ?? i), date: String(r._date ?? ""), fields: { miles: String(r.miles ?? "") } })), nextCursor: body.nextCursor };
      } },
      { ...cfg, sourceText: "" },
      { store, fetchImpl: fetch, maxPages: 1 },
    );
    expect(first.rowsPulled).toBe(1);
    expect(await store.getCursor(ORG, "rest-paginated")).toBe("p2");
    const second = await runConnectorPull(def, cfg, { store, fetchImpl: fetch });
    expect(second.rowsPulled).toBe(1);
    expect(second.cursor).toBeNull();
    expect(store.objects.size).toBe(2);
  });
});

describe("retry policy + degraded (F2-00004/5 family)", () => {
  it("retries 500 twice then succeeds", async () => {
    let calls = 0;
    const r = await fetchWithRetry("https://example.test/x", {
      fetchImpl: async () => (++calls < 3 ? { status: 500, text: async () => "e" } : { status: 200, text: async () => "{}" }),
      timeoutMs: 1000,
    });
    expect(r.ok).toBe(true);
    expect(calls).toBe(3);
  });
  it("gives up after retries and marks degraded without throwing", async () => {
    const r = await fetchWithRetry("https://example.test/x", {
      fetchImpl: async () => ({ status: 500, text: async () => "e" }),
      timeoutMs: 1000,
    });
    expect(r.ok).toBe(false);
    expect(r.degraded).toBe(true);
  });
  it("does not retry 400-class (non-retryable) errors", async () => {
    let calls = 0;
    const r = await fetchWithRetry("https://example.test/x", {
      fetchImpl: async () => (++calls, { status: 400, text: async () => "bad" }),
      timeoutMs: 1000,
    });
    expect(r.ok).toBe(false);
    expect(calls).toBe(1);
  });
  it("livedata source down yields DEGRADED, pipeline continues", async () => {
    const store = memoryConnectorStore();
    const s = await runConnectorPull(
      getConnector("opencorporates")!,
      { key: "opencorporates", organizationId: ORG, sourceText: "Acme Corp" },
      { store, fetchImpl: async () => ({ status: 500, text: async () => "down" }) },
    );
    expect(s.status).toBe("DEGRADED");
    expect(s.degradedSources.length).toBeGreaterThan(0);
    expect(store.runs).toHaveLength(1);
  });
});

describe("mapping presets persist per org (F2-00007 family)", () => {
  it("save/get round-trips; re-pull path reads it back", async () => {
    const store = memoryConnectorStore();
    expect(await store.getMapping(ORG, "csv-upload")).toBeNull();
    await store.saveMapping(ORG, "csv-upload", { loadid: 0, miles: 2 });
    expect(await store.getMapping(ORG, "csv-upload")).toEqual({ loadid: 0, miles: 2 });
  });
});

describe("dedupe + merge-never-clobber (F2-00008/22 family)", () => {
  const csv1 = "LoadID,Miles\nD1,100";
  const csv2 = "LoadID,Revenue\nD1,500";
  it("re-pull of the same key updates in place; partial fields merge", async () => {
    const store = memoryConnectorStore();
    const def = getConnector("csv-upload")!;
    await runConnectorPull(def, csvConfig("csv-upload", csv1), { store });
    await runConnectorPull(def, csvConfig("csv-upload", csv2), { store });
    expect(store.objects.size).toBe(1);
    const obj = store.objects.get(`${ORG}:conn_csv_upload:D1`)!;
    expect(obj.data.miles).toBe("100");
    expect(obj.data.revenue).toBe("500");
  });
});

describe("ledger + import history (F2-00009/24 family)", () => {
  it("every pull writes a SyncRun; listing returns last-20 newest-first", async () => {
    const store = memoryConnectorStore();
    const def = getConnector("csv-upload")!;
    await runConnectorPull(def, csvConfig("csv-upload", "LoadID\nA"), { store });
    await runConnectorPull(def, csvConfig("csv-upload", "LoadID\nB"), { store });
    const runs = await store.listSyncRuns(ORG, 20);
    expect(runs).toHaveLength(2);
    expect(runs[0].rowsPulled).toBe(1);
    expect(runs[0].status).toBe("COMPLETED");
    expect(runs[0].triggeredById).toBe("");
  });
});

describe("freshness badges (F2-00010 family)", () => {
  const now = Date.now();
  it("fresh / stale / never states + badge copy", async () => {
    const store = memoryConnectorStore();
    expect(connectorFreshness(null, now, 1000).state).toBe("never");
    expect(freshnessBadge(null, now, 1000)).toBe("NEVER SYNCED");
    expect(connectorFreshness(new Date(now - 1000), now, 3600000).state).toBe("fresh");
    expect(freshnessBadge(new Date(now - 1000), now, 3600000)).toBe("FRESH");
    expect(connectorFreshness(new Date(now - 30 * 3600000), now, 3600000).state).toBe("stale");
    expect(freshnessBadge(new Date(now - 30 * 3600000), now, 3600000)).toMatch(/^STALE/);
    const def = getConnector("csv-upload")!;
    await runConnectorPull(def, csvConfig("csv-upload", "LoadID\nA"), { store });
    expect(await store.lastPulledAt(ORG, "csv-upload")).toBeInstanceOf(Date);
  });
});

describe("backfill without dupes (F2-00011 family)", () => {
  it("date-range re-pull replays but object count stays flat", async () => {
    const store = memoryConnectorStore();
    const def = getConnector("csv-upload")!;
    const csv = "LoadID,PickupDate\nB1,2026-08-01\nB2,2026-08-02";
    await runConnectorPull(def, csvConfig("csv-upload", csv), { store });
    const s = await runConnectorPull(
      def,
      csvConfig("csv-upload", csv, { dateFrom: "2026-08-01", dateTo: "2026-08-31" }),
      { store },
    );
    expect(s.status).toBe("COMPLETED");
    expect(store.objects.size).toBe(2);
  });
});

describe("delete handling via tombstones (F2-00012 family)", () => {
  it("full-set clean pull tombstones vanished keys; facts stay readable", async () => {
    const store = memoryConnectorStore();
    const def = getConnector("csv-upload")!;
    await runConnectorPull(def, csvConfig("csv-upload", "LoadID\nT1\nT2"), { store });
    const s = await runConnectorPull(def, csvConfig("csv-upload", "LoadID\nT1", { fullRefresh: true }), { store });
    expect(s.tombstoned).toBe(1);
    expect(await store.getLiveKeys(ORG, "conn_csv_upload")).toEqual(["T1"]);
    expect(store.objects.get(`${ORG}:conn_csv_upload:T2`)?.deletedAt).toBeInstanceOf(Date);
  });
});

describe("PII scrub (F2-00013 family)", () => {
  it("SSN redacted before storage; raw value never lands", async () => {
    const store = memoryConnectorStore();
    const s = await runConnectorPull(
      getConnector("manual-form")!,
      { key: "manual-form", organizationId: ORG, sourceText: `{"_key":"m1","driver":"Jane 123-45-6789"}` },
      { store },
    );
    expect(s.status).toBe("COMPLETED");
    const obj = store.objects.get(`${ORG}:conn_manual_form:m1`)!;
    expect(obj.data.driver).toBe("Jane [REDACTED-SSN]");
    expect(JSON.stringify([...store.objects.values()])).not.toContain("123-45-6789");
    const { redactedFields } = scrubPIIRow({ key: "k", fields: { a: "x" } });
    expect(redactedFields).toEqual([]);
  });
});

describe("large file streams (F2-00014 family)", () => {
  it("10k rows complete without blocking the runner", async () => {
    const lines = ["LoadID,Miles"];
    for (let i = 0; i < 10_000; i++) lines.push(`G${i},${i % 500}`);
    const store = memoryConnectorStore();
    const seen: number[] = [];
    const s = await runConnectorPull(getConnector("csv-upload")!, csvConfig("csv-upload", lines.join("\n")), {
      store,
      onProgress: (p) => seen.push(p),
    });
    expect(s.status).toBe("COMPLETED");
    expect(s.rowsPulled).toBe(10_000);
    expect(store.objects.size).toBe(10_000);
    expect(seen.length).toBeGreaterThan(0);
  });
});

describe("adversarial payloads (F2-00015 family)", () => {
  it("unicode + future dates + all-null column handled per spec", async () => {
    const store = memoryConnectorStore();
    const csv = "LoadID,PickupDate,Notes,Empty\nH584Ü,2099-01-01,héllo,";
    const s = await runConnectorPull(getConnector("csv-upload")!, csvConfig("csv-upload", csv), { store });
    expect(s.status).toBe("COMPLETED");
    expect(s.rowsUpserted).toBe(1);
  });
});

describe("secrets stay server-side (F2-00016 family)", () => {
  const secretDef: ConnectorDefinition = {
    key: "rest-paginated",
    label: "t",
    kind: "rest",
    requiresKeys: ["FAKE_CONNECTOR_KEY_X"],
    defaultRpm: 1,
    fullSet: false,
    freshnessSlaMs: 1000,
    pull: async () => ({ rows: [], nextCursor: null }),
  };
  it("missing key fails the pull naming the key, never a value", async () => {
    const store = memoryConnectorStore();
    const s = await runConnectorPull(secretDef, { key: "rest-paginated", organizationId: ORG }, { store });
    expect(s.status).toBe("FAILED");
    expect(s.failureReason).toMatch(/FAKE_CONNECTOR_KEY_X/);
    expect(checkConnectorSecrets(secretDef, {}).ok).toBe(false);
    expect(checkConnectorSecrets(secretDef, { FAKE_CONNECTOR_KEY_X: "v" }).ok).toBe(true);
    expect(() => requireConnectorSecrets(secretDef, {})).toThrow(/host secret store/);
  });
});

describe("rate budget pauses schedule (F2-00017 family)", () => {
  it("429 degrades + pauses; immediate re-pull skips", async () => {
    const store = memoryConnectorStore();
    const def = getConnector("rest-paginated")!;
    const cfg = { key: "rest-paginated", organizationId: ORG, endpoint: "https://example.test/api" };
    const s = await runConnectorPull(def, cfg, {
      store,
      fetchImpl: async () => ({ status: 429, text: async () => "slow down" }),
    });
    expect(s.status).toBe("DEGRADED");
    expect(s.degradedSources[0]).toMatch(/^rate-limited/);
    const skip = await runConnectorPull(def, cfg, {
      store,
      fetchImpl: okFetch(`{"rows":[],"nextCursor":null}`),
    });
    expect(skip.status).toBe("SKIPPED");
    expect(skip.failureReason).toMatch(/paused until/);
  });
  it("rpm window math holds", () => {
    expect(rpmWindowMs(60)).toBe(1000);
    expect(rpmWindowMs(120)).toBe(500);
  });
});

describe("dry-run preview writes nothing (F2-00018 family)", () => {
  it("first 20 rows returned; store untouched", async () => {
    const lines = ["LoadID"];
    for (let i = 0; i < 25; i++) lines.push(`P${i}`);
    const store = memoryConnectorStore();
    const prev = await previewConnectorPull(getConnector("csv-upload")!, csvConfig("csv-upload", lines.join("\n")), {});
    expect(prev.rows).toHaveLength(20);
    expect(prev.mapping.loadid).toBe(0);
    expect(store.runs).toHaveLength(0);
    expect(store.objects.size).toBe(0);
  });
});

describe("conflicts surface per field (F2-00020 family)", () => {
  it("findConflicts reports ours/theirs with run id", () => {
    const conflicts = findConflicts(new Map([["L1", { miles: "100", revenue: "400" }]]), [
      { runId: "run-old", loadKey: "L1", data: { miles: "120", revenue: "400" } },
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ loadKey: "L1", field: "miles", ours: "100", theirs: "120" });
  });
});

describe("resume after kill (F2-00021 family)", () => {
  it("failed run keeps its cursor; resume finishes with zero dupes", async () => {
    const store = memoryConnectorStore();
    let failPage2 = true;
    const def: ConnectorDefinition = {
      key: "rest-paginated",
      label: "t",
      kind: "rest",
      requiresKeys: [],
      defaultRpm: 10,
      fullSet: false,
      freshnessSlaMs: 1000,
      pull: async (ctx) => {
        if (!ctx.cursor) return { rows: [{ key: "k1", fields: { v: "1" } }], nextCursor: "p2" };
        if (failPage2) throw new Error("worker died mid-pull");
        return { rows: [{ key: "k2", fields: { v: "2" } }], nextCursor: null };
      },
    };
    const cfg = { key: "rest-paginated", organizationId: ORG };
    const first = await runConnectorPull(def, cfg, { store });
    expect(first.status).toBe("FAILED");
    expect(await store.getCursor(ORG, "rest-paginated")).toBe("p2");
    failPage2 = false;
    const second = await runConnectorPull(def, cfg, { store });
    expect(second.status).toBe("COMPLETED");
    expect(second.rowsPulled).toBe(1);
    expect(store.objects.size).toBe(2);
  });
});

describe("export back to CSV (F2-00025 family)", () => {
  it("escapes commas and quotes", () => {
    const csv = rowsToCsv([{ key: "e1", date: "2026-09-01", fields: { note: 'say "hi", ok', miles: "5" } }]);
    expect(csv).toContain('"say ""hi"", ok"');
    expect(csv.split("\n")).toHaveLength(2);
  });
});

describe("notifications ping owners (F2-00026 family)", () => {
  it("COMPLETED and FAILED both notify", async () => {
    const seen: string[] = [];
    const store = memoryConnectorStore();
    const def = getConnector("csv-upload")!;
    const notify = async (s: { status: string }) => {
      seen.push(s.status);
    };
    await runConnectorPull(def, csvConfig("csv-upload", "LoadID\nN1"), { store, notify });
    await runConnectorPull(def, { key: "csv-upload", organizationId: "" }, { store, notify });
    expect(seen).toEqual(["COMPLETED", "FAILED"]);
  });
});

describe("kill check flags idle connectors (F2-00030 family)", () => {
  it("30d+ idle and never-synced flagged; fresh not flagged", () => {
    const now = Date.now();
    const out = flagUnusedConnectors(
      ["csv-upload", "xlsx-upload", "gdelt"],
      {
        "csv-upload": new Date(now - 40 * 86400000),
        "xlsx-upload": new Date(now - 5 * 86400000),
        gdelt: null,
      },
      now,
    );
    expect(out.find((o) => o.key === "csv-upload")?.flagged).toBe(true);
    expect(out.find((o) => o.key === "xlsx-upload")?.flagged).toBe(false);
    expect(out.find((o) => o.key === "gdelt")?.flagged).toBe(true);
  });
});

describe("progress callback fires during pulls", () => {
  it("reports increasing percentages", async () => {
    const store = memoryConnectorStore();
    const seen: number[] = [];
    await runConnectorPull(getConnector("csv-upload")!, csvConfig("csv-upload", "LoadID\nQ1"), {
      store,
      onProgress: (p) => seen.push(p),
    });
    expect(seen.length).toBeGreaterThan(0);
    expect(Math.max(...seen)).toBeLessThanOrEqual(90);
  });
});

describe("per-connector fixtures + docs ship (F2-00028/29 family)", () => {
  const root = join(process.cwd(), "fixtures");
  const docs = join(process.cwd(), "(marketing)", "docs", "connectors");
  it.each(CONNECTOR_KEYS)("%s has a fixture and a doc page", (key) => {
    const csv = join(root, `connector-${key}.csv`);
    const xlsx = join(root, `connector-${key}.xlsx`);
    expect(existsSync(csv) || existsSync(xlsx), `fixture for ${key}`).toBe(true);
    expect(existsSync(join(docs, `${key}.md`)), `doc for ${key}`).toBe(true);
  });
  it("csv fixtures parse through the real csv pull", async () => {
    const store = memoryConnectorStore();
    const text = readFileSync(join(root, "connector-csv-upload.csv"), "utf8");
    const s = await runConnectorPull(getConnector("csv-upload")!, csvConfig("csv-upload", text), { store });
    expect(s.status).toBe("COMPLETED");
    expect(s.rowsPulled).toBeGreaterThan(0);
  });
});
