import { z } from "zod";
import { KEY_RE } from "@/lib/core/ontology/schema";
import {
  StepBudget,
  collectRefs,
  evaluate,
  evaluateFormula,
  orderFormulas,
  parseFormula,
} from "@/lib/core/ontology/formulas";
import { avg, median, sum } from "@/lib/core/ontology/aggregations";

// ---------------------------------------------------------------------------
// Function registry core (pure, no DB): versioned deterministic logic that
// agents, boards and actions resolve through ONE executor instead of
// hardcoded call sites (Phase D, F2-02751+). Purity is structural — this
// module has no database access, so a pure spec physically cannot write.
// ---------------------------------------------------------------------------

export const FUNCTION_KINDS = ["formula", "aggregation", "composite", "native"] as const;
export type FunctionKind = (typeof FUNCTION_KINDS)[number];

export const functionSpecSchema = z.object({
  key: z.string().regex(KEY_RE, "key must be snake_case, 2-64 chars"),
  label: z.string().min(1).max(120),
  targetTypeKey: z.string().max(64).optional(),
  pure: z.boolean().default(true),
  budgetMs: z.number().int().min(100).max(60000).default(5000),
  kind: z.enum(FUNCTION_KINDS),
  code: z.record(z.unknown()),
  enabled: z.boolean().default(true),
});

export type FunctionSpec = z.infer<typeof functionSpecSchema>;

export interface SpecProblem {
  field: string;
  message: string;
}

export function validateFunctionSpec(input: unknown): { ok: true; value: FunctionSpec } | { ok: false; problems: SpecProblem[] } {
  const parsed = functionSpecSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    };
  }
  const problems: SpecProblem[] = [];
  const code = parsed.data.code as Record<string, unknown>;
  switch (parsed.data.kind) {
    case "formula": {
      if (typeof code.expression !== "string" || code.expression.length === 0) {
        problems.push({ field: "code.expression", message: "formula needs a non-empty expression string" });
      } else if (code.expression.length > 2000) {
        problems.push({ field: "code.expression", message: "expression exceeds the 2000-char budget" });
      } else {
        try {
          parseFormula(code.expression);
        } catch (e) {
          problems.push({ field: "code.expression", message: e instanceof Error ? e.message : "unparseable" });
        }
      }
      break;
    }
    case "aggregation": {
      if (!["sum", "avg", "median"].includes(String(code.op))) {
        problems.push({ field: "code.op", message: "aggregation op must be sum|avg|median" });
      }
      if (typeof code.field !== "string" || code.field.length === 0) {
        problems.push({ field: "code.field", message: "aggregation needs a field name" });
      }
      break;
    }
    case "composite": {
      const formulas = code.formulas;
      if (!Array.isArray(formulas) || formulas.length === 0 || formulas.length > 20) {
        problems.push({ field: "code.formulas", message: "composite needs 1-20 named formulas" });
        break;
      }
      try {
        const names: string[] = [];
        const deps = new Map<string, Set<string>>();
        for (const f of formulas) {
          const fm = f as { name?: unknown; expression?: unknown };
          if (typeof fm.name !== "string" || typeof fm.expression !== "string") {
            throw new Error("each composite formula needs a string name and expression");
          }
          names.push(fm.name);
          deps.set(fm.name, collectRefs(parseFormula(fm.expression)));
        }
        orderFormulas(names, deps);
      } catch (e) {
        problems.push({ field: "code.formulas", message: e instanceof Error ? e.message : "invalid composite" });
      }
      break;
    }
    case "native": {
      if (typeof code.handler !== "string" || code.handler.length === 0) {
        problems.push({ field: "code.handler", message: "native needs a handler name" });
      }
      break;
    }
  }
  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, value: parsed.data };
}

export type NativeHandlers = Record<string, (args: Record<string, unknown>) => unknown | Promise<unknown>>;

export interface ExecuteOpts {
  nativeHandlers?: NativeHandlers;
  budgetMs?: number;
  version?: number;
}

export interface ExecuteResult {
  ok: boolean;
  value?: unknown;
  error?: string;
  version: number | null;
  latencyMs: number;
}

export async function executeFunctionSpec(
  spec: FunctionSpec,
  args: Record<string, unknown>,
  opts: ExecuteOpts = {},
): Promise<ExecuteResult> {
  const t0 = Date.now();
  const done = (ok: boolean, value?: unknown, error?: string): ExecuteResult => ({
    ok,
    value,
    error,
    version: opts.version ?? null,
    latencyMs: Date.now() - t0,
  });
  const budgetMs = opts.budgetMs ?? spec.budgetMs;
  try {
    switch (spec.kind) {
      case "formula": {
        const value = evaluateFormula((spec.code as { expression: string }).expression, args);
        return done(true, value);
      }
      case "aggregation": {
        const { op, field } = spec.code as { op: string; field: string };
        const rows = Array.isArray(args.rows) ? (args.rows as Array<Record<string, unknown>>) : null;
        if (!rows) return done(false, undefined, "aggregation needs args.rows array");
        const value = op === "sum" ? sum(rows, field) : op === "avg" ? avg(rows, field) : median(rows, field);
        return done(true, value);
      }
      case "composite": {
        const budget = new StepBudget();
        const formulas = (spec.code as { formulas: Array<{ name: string; expression: string }> }).formulas;
        const names = formulas.map((f) => f.name);
        const deps = new Map(names.map((n) => {
          const expr = formulas.find((f) => f.name === n)!.expression;
          return [n, collectRefs(parseFormula(expr))] as [string, Set<string>];
        }));
        const order = orderFormulas(names, deps);
        const ctx: Record<string, unknown> = { ...args };
        const out: Record<string, unknown> = {};
        for (const name of order) {
          const expr = formulas.find((f) => f.name === name)!.expression;
          const v = evaluate(parseFormula(expr), ctx, budget);
          out[name] = v;
          ctx[name] = v;
        }
        return done(true, out);
      }
      case "native": {
        const handler = (spec.code as { handler: string }).handler;
        const fn = opts.nativeHandlers?.[handler];
        if (!fn) return done(false, undefined, `unknown native handler: ${handler}`);
        const value = await withTimeout(Promise.resolve().then(() => fn(args)), budgetMs);
        return done(true, value);
      }
    }
  } catch (e) {
    return done(false, undefined, e instanceof Error ? e.message : "execution failed");
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`function exceeded ${ms}ms budget`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

// ---------- versions (append-only; rollback = new version, never rewrite) ----------

export function snapshotOf(spec: FunctionSpec): Record<string, unknown> {
  return JSON.parse(JSON.stringify(spec)) as Record<string, unknown>;
}

export function versionNote(prev: Record<string, unknown> | null, next: Record<string, unknown>): string {
  if (!prev) return "initial version";
  const changed: string[] = [];
  for (const k of Object.keys(next)) {
    if (JSON.stringify(prev[k]) !== JSON.stringify(next[k])) changed.push(k);
  }
  return changed.length === 0 ? "no changes" : `changed: ${changed.join(", ")}`;
}

// ---------- metrics (in-memory ring, same rationale as kinds-telemetry) ----------

interface CallSample {
  ok: boolean;
  latencyMs: number;
}

const RING_MAX = 200;
const calls = new Map<string, CallSample[]>();

export function recordFunctionCall(key: string, ok: boolean, latencyMs: number): void {
  const ring = calls.get(key) ?? [];
  ring.push({ ok, latencyMs });
  calls.set(key, ring.slice(-RING_MAX));
}

export function functionStats(key: string): { calls: number; fails: number; p50: number; p95: number } {
  const ring = calls.get(key) ?? [];
  const lat = ring.map((r) => r.latencyMs).sort((a, b) => a - b);
  const pct = (p: number) => (lat.length === 0 ? 0 : lat[Math.min(lat.length - 1, Math.floor((p / 100) * lat.length))]!);
  return {
    calls: ring.length,
    fails: ring.filter((r) => !r.ok).length,
    p50: pct(50),
    p95: pct(95),
  };
}

export function resetFunctionMetrics(): void {
  calls.clear();
}

// ---------- board variables: functions compute live values for widgets ----------

export async function resolveBoardVariable(
  spec: FunctionSpec,
  ctx: Record<string, unknown>,
  opts: ExecuteOpts = {},
): Promise<{ value: unknown; evaluatedAt: string; version: number | null; error?: string }> {
  const r = await executeFunctionSpec(spec, ctx, opts);
  return {
    value: r.ok ? r.value : null,
    evaluatedAt: new Date().toISOString(),
    version: r.version,
    ...(r.ok ? {} : { error: r.error }),
  };
}
