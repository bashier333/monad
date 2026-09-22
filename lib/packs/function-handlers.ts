import { coverageDays } from "@/lib/packs/manufacturing/logic/coverage";
import { reorderSuggestions } from "@/lib/packs/manufacturing/logic/reorder";
import { fulfillmentRisks } from "@/lib/packs/manufacturing/logic/risk";
import { demandForecast } from "@/lib/packs/manufacturing/logic/forecast";
import { trailingSum, weekOverWeek } from "@/lib/core/ontology/aggregations";
import { normalizeName, scoreMatch, classifyMatch } from "@/lib/core/ontology/identity";
import { buildAdjacency, degreeRank, shortestPath } from "@/lib/core/ontology/graph";
import { dedupeFlags, fuseFlags } from "@/lib/core/livedata/fuse";
import type { LiveFlag } from "@/lib/core/livedata/types";
import { decideVerdict } from "@/lib/core/livedata/verdict";
import { quorumReached } from "@/lib/core/ontology/actions";
import { connectorFreshness } from "@/lib/core/ingest/connector";
import { impactSimulation } from "@/lib/packs/manufacturing/logic/impact";
import { buildMfgBrief, buildMfgBriefVariants } from "@/lib/packs/manufacturing/brief/build";
import type { NativeHandlers } from "@/lib/core/ontology/functions";

// Pack native handlers: the executable bodies behind registry `native`
// functions. Every handler is a pure function of its args (explicit inputs,
// no ambient context) so registry execution is deterministic and testable.
// Handlers never write — the executor has no database access by construction.

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

type Rows = Array<Record<string, unknown>>;

export const packNativeHandlers: NativeHandlers = {
  coverage_days: (args) => {
    const qty = num(args.qtyOnHand ?? args.qty_on_hand ?? 0) ?? 0;
    const demand = num(args.dailyDemand ?? args.daily_demand) ?? 0;
    return coverageDays(qty, demand);
  },
  reorder_suggestion: (args) => {
    const lots = (Array.isArray(args.lots) ? args.lots : []) as Array<{
      id?: unknown; key?: unknown; data?: Record<string, unknown>;
    }>;
    const edges = (Array.isArray(args.edges) ? args.edges : []) as Array<{
      fromId: string; linkKey: string; toId: string;
    }>;
    const norm = lots.map((l, i) => ({
      id: String(l.id ?? l.key ?? `lot-${i}`),
      key: String(l.key ?? l.id ?? `lot-${i}`),
      data: {
        qty_on_hand: num(l.data?.qty_on_hand) ?? 0,
        reorder_point: num(l.data?.reorder_point),
        safety_stock: num(l.data?.safety_stock),
        daily_demand: num(l.data?.daily_demand),
      },
    }));
    return reorderSuggestions(norm, edges);
  },
  fulfillment_risk: (args) => {
    const shipments = (Array.isArray(args.shipments) ? args.shipments : []) as Array<{
      id?: unknown; key?: unknown; data?: Record<string, unknown>;
    }>;
    const rawAdjacency = (Array.isArray(args.adjacency) ? args.adjacency : []) as Array<{
      fromId: unknown; linkKey: unknown; toId: unknown;
    }>;
    const adjacency = new Map<string, Array<{ fromId: string; linkKey: string; toId: string }>>();
    for (const e of rawAdjacency) {
      if (typeof e?.fromId !== "string") continue;
      const list = adjacency.get(e.fromId) ?? [];
      list.push({ fromId: e.fromId, linkKey: String(e.linkKey ?? ""), toId: String(e.toId ?? "") });
      adjacency.set(e.fromId, list);
    }
    const norm = shipments.map((s, i) => ({
      id: String(s.id ?? s.key ?? `sh-${i}`),
      key: String(s.key ?? s.id ?? `sh-${i}`),
      data: {
        status: String(s.data?.status ?? ""),
        qty: num(s.data?.qty),
        sla_hours: num(s.data?.sla_hours),
      },
    }));
    return fulfillmentRisks(norm, adjacency);
  },
  demand_forecast: (args) => {
    const history = (Array.isArray(args.history) ? args.history : []) as Array<{
      weekStart?: unknown; demand?: unknown;
    }>;
    const points = history
      .filter((h) => typeof h.weekStart === "string" && num(h.demand) !== null)
      .map((h) => ({ weekStart: h.weekStart as string, demand: num(h.demand)! }));
    return demandForecast(points);
  },
  revenue_match: (args) => {
    // Fuzzy settlement→load matching over caller-supplied rows. Each
    // settlement scores against every load id; best score wins when it
    // clears the review threshold, otherwise the settlement stays unmatched
    // (listed, never hidden).
    const settlements = (Array.isArray(args.settlements) ? args.settlements : []) as Rows;
    const loads = (Array.isArray(args.loads) ? args.loads : []) as Rows;
    return settlements.map((s, i) => {
      const ref = String(s.reference ?? s.load_id ?? "");
      let best: { load: string; score: number } | null = null;
      for (const l of loads) {
        const lid = String(l.load_id ?? l.key ?? "");
        if (!lid) continue;
        const { score } = scoreMatch(ref, lid);
        if (!best || score > best.score) best = { load: lid, score };
      }
      const matched = best && best.score >= 0.7 ? best.load : null;
      return {
        settlement: String(s.id ?? `st-${i}`),
        reference: ref,
        amount: num(s.amount) ?? 0,
        matchedLoad: matched,
        confidence: best?.score ?? 0,
        status: matched ? "matched" : "unmatched",
      };
    });
  },
  week_over_week: (args) => {
    const rows = (Array.isArray(args.rows) ? args.rows : []) as Array<Record<string, unknown>>;
    const field = typeof args.field === "string" ? args.field : "revenue";
    const weekStart = typeof args.weekStart === "string" ? args.weekStart : "";
    if (!weekStart) throw new Error("week_over_week needs args.weekStart");
    return weekOverWeek(
      rows.map((r) => ({ ...r, date: String(r.date ?? "") })),
      field,
      weekStart,
    );
  },
  trailing_revenue_30d: (args) => {
    const rows = (Array.isArray(args.rows) ? args.rows : []) as Array<Record<string, unknown>>;
    const field = typeof args.field === "string" ? args.field : "revenue";
    const endDate = typeof args.endDate === "string" ? args.endDate : new Date().toISOString().slice(0, 10);
    return trailingSum(
      rows.map((r) => ({ ...r, date: String(r.date ?? "") })),
      field,
      endDate,
      30,
    );
  },
};

function rowsOf(args: Record<string, unknown>, name: string): Rows {
  const v = args[name];
  if (!Array.isArray(v)) throw new Error(`${name} must be an array of rows`);
  return v as Rows;
}

function strOf(v: unknown): string {
  return v == null ? "" : String(v);
}

export const extendedNativeHandlers: NativeHandlers = {
  top_drivers: (args) => {
    const rows = rowsOf(args, "rows");
    const scored = rows
      .map((r) => ({ lane: strOf(r.lane ?? r.key), margin: num(r.margin) ?? 0 }))
      .filter((r) => r.lane !== "")
      .sort((a, b) => a.margin - b.margin)
      .slice(0, 3);
    const totalNeg = scored.filter((s) => s.margin < 0).reduce((a, s) => a + Math.abs(s.margin), 0);
    return scored.map((s) => ({
      ...s,
      shareOfLoss: totalNeg === 0 ? 0 : Math.round((Math.abs(Math.min(s.margin, 0)) / totalNeg) * 1000) / 1000,
    }));
  },
  anomaly_flag: (args) => {
    const current = rowsOf(args, "current");
    const previous = rowsOf(args, "previous");
    const thresholdPct = num(args.thresholdPct) ?? 20;
    const prevByKey = new Map(previous.map((r) => [strOf(r.key), num(r.value) ?? 0]));
    const flags: Array<Record<string, unknown>> = [];
    for (const c of current) {
      const key = strOf(c.key);
      const cur = num(c.value) ?? 0;
      const prev = prevByKey.get(key) ?? 0;
      if (prev === 0) {
        if (cur !== 0) flags.push({ key, previous: 0, current: cur, swingPct: null, note: "new series" });
        continue;
      }
      const swingPct = Math.abs((cur - prev) / Math.abs(prev)) * 100;
      if (swingPct > thresholdPct) flags.push({ key, previous: prev, current: cur, swingPct: Math.round(swingPct * 10) / 10 });
    }
    return flags;
  },
  cost_attribute: (args) => {
    const costs = rowsOf(args, "costs");
    const loads = rowsOf(args, "loads");
    if (loads.length === 0) throw new Error("cost_attribute needs args.loads");
    const weights = loads.map((l) => {
      const w = num(l.weight);
      return w !== null && w > 0 ? w : 1;
    });
    const totalW = weights.reduce((a, b) => a + b, 0);
    return loads.map((l, i) => {
      const key = strOf(l.key);
      const lines = costs.map((c) => {
        const amount = num(c.amount) ?? 0;
        const tagged = strOf(c.load);
        // Tagged costs belong to their load only — never spread. Untagged
        // costs split pro-rata by weight across every load.
        if (tagged !== "") {
          const direct = tagged === key;
          return { kind: strOf(c.kind), amount, attributed: direct ? amount : 0, basis: "direct" };
        }
        const share = Math.round(((amount * weights[i]!) / totalW) * 100) / 100;
        return { kind: strOf(c.kind), amount, attributed: share, basis: "pro-rata-weight" };
      });
      return { load: key, lines, total: Math.round(lines.reduce((a, l2) => a + l2.attributed, 0) * 100) / 100 };
    });
  },
  deadhead_split: (args) => {
    const emptyMiles = num(args.emptyMiles);
    const causedBy = strOf(args.causedByLoad);
    if (emptyMiles === null || emptyMiles < 0) throw new Error("deadhead_split needs a non-negative args.emptyMiles");
    if (!causedBy) throw new Error("deadhead_split needs args.causedByLoad");
    return { attributedTo: causedBy, emptyMiles, line: `deadhead ${emptyMiles} mi attributed to the lane that caused it (${causedBy})` };
  },
  overhead_split: (args) => {
    const overhead = num(args.overhead);
    const loads = rowsOf(args, "loads");
    if (overhead === null || overhead < 0) throw new Error("overhead_split needs a non-negative args.overhead");
    if (loads.length === 0) throw new Error("overhead_split needs args.loads");
    const revs = loads.map((l) => Math.max(num(l.revenue) ?? 0, 0));
    const total = revs.reduce((a, b) => a + b, 0);
    return loads.map((l, i) => ({
      load: strOf(l.key),
      share: total === 0 ? Math.round((overhead / loads.length) * 100) / 100 : Math.round(((overhead * revs[i]!) / total) * 100) / 100,
      basis: total === 0 ? "equal-split" : "pro-rata-revenue",
    }));
  },
  settlement_fuzzy: (args) => {
    const settlements = rowsOf(args, "settlements");
    const loads = rowsOf(args, "loads");
    return settlements.map((s, i) => {
      const ref = strOf(s.reference ?? s.load_id);
      const candidates = loads
        .map((l) => {
          const lid = strOf(l.load_id ?? l.key);
          if (!lid) return null;
          const { score } = scoreMatch(ref, lid);
          return { load: lid, score };
        })
        .filter((c): c is { load: string; score: number } => c !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      return { settlement: strOf(s.id) || `st-${i}`, reference: ref, candidates };
    });
  },
  lane_normalize: (args) => {
    const aliases = (args.aliases as Record<string, string> | undefined) ?? {};
    const norm = (place: string) => {
      const clean = place.trim().replace(/\s+/g, " ").toUpperCase();
      const key = clean.toLowerCase().replace(/[^a-z0-9]/g, "");
      return aliases[key] ?? clean;
    };
    const origin = strOf(args.origin);
    const destination = strOf(args.destination);
    if (!origin || !destination) throw new Error("lane_normalize needs args.origin and args.destination");
    return { lane: `${norm(origin)}-${norm(destination)}`, origin: norm(origin), destination: norm(destination) };
  },
  place_alias: (args) => {
    const name = strOf(args.name);
    if (!name) throw new Error("place_alias needs args.name");
    const aliases = (args.aliases as Record<string, string> | undefined) ?? {};
    return aliases[normalizeName(name)] ?? name.trim();
  },
  duplicate_score: (args) => {
    const a = strOf(args.a);
    const b = strOf(args.b);
    if (!a || !b) throw new Error("duplicate_score needs args.a and args.b");
    const { score, reasons } = scoreMatch(a, b);
    return { score, class: classifyMatch(score), reasons };
  },
  identity_score: (args) => {
    const a = strOf(args.a);
    const b = strOf(args.b);
    if (!a || !b) throw new Error("identity_score needs args.a and args.b");
    return scoreMatch(a, b);
  },
  merge_plan: (args) => {
    const a = (args.a as Record<string, unknown> | undefined) ?? {};
    const b = (args.b as Record<string, unknown> | undefined) ?? {};
    const keep: string[] = [];
    const fill: string[] = [];
    const conflicts: Array<{ field: string; a: unknown; b: unknown }> = [];
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const va = a[k];
      const vb = b[k];
      const hasA = va !== undefined && va !== null && va !== "";
      const hasB = vb !== undefined && vb !== null && vb !== "";
      if (hasA && hasB && JSON.stringify(va) !== JSON.stringify(vb)) {
        conflicts.push({ field: k, a: va, b: vb });
      } else if (hasA && hasB) {
        continue; // agree — nothing to do
      } else if (hasA) keep.push(k);
      else if (hasB) fill.push(k);
    }
    return { keep, fill, conflicts };
  },
  risk_score: (args) => {
    const flags = rowsOf(args, "flags");
    let crit = 0;
    let warn = 0;
    let info = 0;
    for (const f of flags) {
      const w = num(f.weight) ?? 1;
      if (f.severity === "critical") crit += w;
      else if (f.severity === "warn") warn += w;
      else info += w;
    }
    // Same 2–98 scale as lender verdicts (verdict.ts) so scores compare.
    return Math.max(2, Math.min(98, Math.round(88 - 30 * crit - 12 * warn - 1 * info)));
  },
  verdict_score: (args) => {
    const score = num(args.score);
    if (score === null) throw new Error("verdict_score needs a numeric args.score");
    return { score, verdict: decideVerdict(score) };
  },
  fuse_flags: (args) => {
    const flags: LiveFlag[] = rowsOf(args, "flags").map((f) => ({
      text: strOf(f.text),
      source: strOf(f.source) || "unknown",
      url: typeof f.url === "string" ? f.url : undefined,
      severity: (f.severity === "critical" || f.severity === "warn" ? f.severity : "info") as LiveFlag["severity"],
      at: typeof f.at === "string" ? f.at : undefined,
    }));
    return fuseFlags(flags);
  },
  dedupe_flags: (args) => {
    const flags: LiveFlag[] = rowsOf(args, "flags").map((f) => ({
      text: strOf(f.text),
      source: strOf(f.source) || "unknown",
      severity: (f.severity === "critical" || f.severity === "warn" ? f.severity : "info") as LiveFlag["severity"],
    }));
    return dedupeFlags(flags);
  },
  brief_build: (args) => {
    const overview = args.overview as Parameters<typeof buildMfgBrief>[0];
    const weekStart = strOf(args.weekStart);
    const weekEnd = strOf(args.weekEnd) || weekStart;
    if (!overview || !Array.isArray(overview.coverage) || !weekStart) {
      throw new Error("brief_build needs args.overview (twin shape) and args.weekStart");
    }
    return buildMfgBrief(overview, weekStart, weekEnd);
  },
  brief_variant: (args) => {
    const overview = args.overview as Parameters<typeof buildMfgBriefVariants>[0];
    const base = args.base as Parameters<typeof buildMfgBriefVariants>[1];
    const nodes = (Array.isArray(args.nodes) ? args.nodes : []) as Array<{ id: string; type: string; label: string; region?: string }>;
    if (!overview || !base || !Array.isArray(base.parts)) {
      throw new Error("brief_variant needs args.overview, args.base and args.nodes");
    }
    return buildMfgBriefVariants(overview, base, nodes);
  },
  chart_series: (args) => {
    const rows = rowsOf(args, "rows");
    const x = strOf(args.x) || "date";
    const y = strOf(args.y) || "value";
    return rows
      .map((r) => ({ x: strOf(r[x]), y: num(r[y]) ?? 0 }))
      .filter((p) => p.x !== "")
      .sort((a, b) => (a.x < b.x ? -1 : a.x > b.x ? 1 : 0));
  },
  map_points: (args) => {
    const nodes = rowsOf(args, "nodes");
    const points: Array<Record<string, unknown>> = [];
    let skipped = 0;
    for (const n of nodes) {
      const lat = num(n.lat ?? n.GeoLat);
      const lng = num(n.lng ?? n.GeoLng);
      if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        skipped++;
        continue;
      }
      points.push({ label: strOf(n.label ?? n.key), type: strOf(n.type), lat, lng });
    }
    return { points, skipped };
  },
  graph_rank: (args) => {
    const edges = rowsOf(args, "edges").map((e) => ({
      fromId: strOf(e.fromId),
      linkKey: strOf(e.linkKey),
      toId: strOf(e.toId),
    }));
    const limit = Math.min(Math.max(num(args.limit) ?? 20, 1), 100);
    return degreeRank(edges, limit);
  },
  path_find: (args) => {
    const edges = rowsOf(args, "edges").map((e) => ({
      fromId: strOf(e.fromId),
      linkKey: strOf(e.linkKey),
      toId: strOf(e.toId),
    }));
    const from = strOf(args.from);
    const to = strOf(args.to);
    if (!from || !to) throw new Error("path_find needs args.from and args.to");
    // Directed: stock flows along edge direction. The engine walks both maps,
    // so incoming stays empty — backwards hops are not a supply path.
    return shortestPath(buildAdjacency(edges), new Map(), from, to);
  },
  impact_sim: (args) => {
    const lots = rowsOf(args, "lots").map((l, i) => ({
      id: strOf(l.id ?? l.key) || `lot-${i}`,
      key: strOf(l.key ?? l.id) || `lot-${i}`,
      data: {
        qty_on_hand: num((l.data as Record<string, unknown> | undefined)?.qty_on_hand ?? l.qty_on_hand) ?? 0,
        reorder_point: num((l.data as Record<string, unknown> | undefined)?.reorder_point ?? l.reorder_point),
        safety_stock: num((l.data as Record<string, unknown> | undefined)?.safety_stock ?? l.safety_stock),
        daily_demand: num((l.data as Record<string, unknown> | undefined)?.daily_demand ?? l.daily_demand),
      },
    }));
    const changes = (Array.isArray(args.changes) ? args.changes : []) as Array<{ objectId: string; data: Record<string, unknown> }>;
    return impactSimulation(lots, changes);
  },
  scenario_diff: (args) => {
    const before = (args.before as Record<string, unknown> | undefined) ?? {};
    const after = (args.after as Record<string, unknown> | undefined) ?? {};
    const diff: Array<{ field: string; before: unknown; after: unknown }> = [];
    for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
        diff.push({ field: k, before: before[k] ?? null, after: after[k] ?? null });
      }
    }
    return diff;
  },
  approval_quorum: (args) => {
    const approvals = (Array.isArray(args.approvals) ? args.approvals : []).map((a) =>
      typeof a === "string" ? a : strOf((a as Record<string, unknown>).byId),
    );
    const requiredCount = num(args.requiredCount);
    if (requiredCount === null || requiredCount < 1) throw new Error("approval_quorum needs a positive args.requiredCount");
    return { reached: quorumReached(approvals, Math.floor(requiredCount)), unique: new Set(approvals).size, required: Math.floor(requiredCount) };
  },
  notify_list: (args) => {
    const members = rowsOf(args, "members");
    const roles = (Array.isArray(args.roles) ? args.roles : []).map(String);
    return members
      .filter((m) => roles.length === 0 || roles.includes(strOf(m.role)))
      .map((m) => strOf(m.userId))
      .filter(Boolean);
  },
  webhook_params: (args) => {
    const template = (args.template as Record<string, unknown> | undefined) ?? {};
    const data = (args.data as Record<string, unknown> | undefined) ?? {};
    const fill = (v: unknown): unknown => {
      if (typeof v !== "string") return v;
      return v.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k: string) => strOf(data[k]));
    };
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(template)) out[k] = fill(v);
    return out;
  },
  currency_norm: (args) => {
    const amount = num(args.amount);
    const currency = strOf(args.currency).toUpperCase();
    if (amount === null) throw new Error("currency_norm needs a numeric args.amount");
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error("currency_norm needs a 3-letter args.currency (no conversion performed)");
    return { amount: Math.round(amount * 100) / 100, currency };
  },
  unit_norm: (args) => {
    const value = num(args.value);
    const from = strOf(args.from).toLowerCase();
    const to = strOf(args.to).toLowerCase();
    if (value === null) throw new Error("unit_norm needs a numeric args.value");
    const MI_TO_KM = 1.60934;
    const key = `${from}->${to}`;
    const factors: Record<string, number> = { "mi->km": MI_TO_KM, "km->mi": 1 / MI_TO_KM, "mi->mi": 1, "km->km": 1 };
    if (!(key in factors)) throw new Error("unit_norm supports mi<->km only");
    return { value: Math.round(value * factors[key]! * 100) / 100, unit: to };
  },
  week_bounds: (args) => {
    const date = strOf(args.date);
    const t = Date.parse(date);
    if (Number.isNaN(t)) throw new Error("week_bounds needs a parseable args.date");
    const weekStartsOn = num(args.weekStartsOn) === 0 ? 0 : 1;
    const d = new Date(t);
    const day = d.getUTCDay();
    const back = (day - weekStartsOn + 7) % 7;
    const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back));
    const end = new Date(start.getTime() + 6 * 86400000);
    const iso = (x: Date) => x.toISOString().slice(0, 10);
    return { weekStart: iso(start), weekEnd: iso(end) };
  },
  freshness_check: (args) => {
    const raw = args.lastPulledAt;
    const last = typeof raw === "string" && raw !== "" ? new Date(raw) : null;
    const slaMs = num(args.slaMs) ?? 86400000;
    const nowMs = num(args.nowMs) ?? Date.now();
    if (last && Number.isNaN(last.getTime())) throw new Error("freshness_check needs a valid args.lastPulledAt");
    return connectorFreshness(last, nowMs, slaMs);
  },
  eval_metric: (args) => {
    const kind = args.kind === "tolerance" ? "tolerance" : "exact";
    const expected = args.expected;
    const actual = args.actual;
    if (kind === "exact") {
      const pass = JSON.stringify(expected) === JSON.stringify(actual);
      return { pass, score: pass ? 1 : 0 };
    }
    const tolerance = num(args.tolerance) ?? 0.01;
    const e = num(expected);
    const a = num(actual);
    if (e === null || a === null) return { pass: false, score: 0, error: "tolerance eval needs numeric expected/actual" };
    const pass = Math.abs(e - a) <= tolerance;
    return { pass, score: pass ? 1 : Math.max(0, 1 - Math.abs(e - a) / (Math.abs(e) || 1)) };
  },
  trace_link: (args) => {
    const runId = strOf(args.runId);
    if (!runId) throw new Error("trace_link needs args.runId");
    const objectIds = (Array.isArray(args.objectIds) ? args.objectIds : []).map(String).filter(Boolean);
    return { traceId: runId, links: objectIds.map((id) => ({ objectId: id, href: `/ontology/explore?id=${encodeURIComponent(id)}` })) };
  },
};

export const allNativeHandlers: NativeHandlers = { ...packNativeHandlers, ...extendedNativeHandlers };
