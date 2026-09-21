export type Value = number | null;

type Token =
  | { kind: "num"; value: number }
  | { kind: "ident"; name: string }
  | { kind: "op"; op: string }
  | { kind: "lparen" }
  | { kind: "rparen" }
  | { kind: "comma" };

const FN_NAMES = new Set(["abs", "round", "ceil", "floor", "min", "max"]);

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      const m = /^[0-9]*\.?[0-9]+/.exec(src.slice(i));
      if (!m) throw new Error(`bad number at ${i}`);
      tokens.push({ kind: "num", value: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      const m = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(src.slice(i));
      tokens.push({ kind: "ident", name: m![0] });
      i += m![0].length;
      continue;
    }
    if (c === "(") {
      tokens.push({ kind: "lparen" });
      i++;
      continue;
    }
    if (c === ")") {
      tokens.push({ kind: "rparen" });
      i++;
      continue;
    }
    if (c === ",") {
      tokens.push({ kind: "comma" });
      i++;
      continue;
    }
    if ("+-*/%^".includes(c)) {
      tokens.push({ kind: "op", op: c });
      i++;
      continue;
    }
    throw new Error(`unexpected character '${c}' at ${i}`);
  }
  return tokens;
}

export type AstNode =
  | { kind: "num"; value: number }
  | { kind: "ref"; name: string }
  | { kind: "neg"; expr: AstNode }
  | { kind: "bin"; op: string; left: AstNode; right: AstNode }
  | { kind: "call"; name: string; args: AstNode[] };

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  parse(): AstNode {
    const node = this.additive();
    if (this.pos < this.tokens.length) throw new Error("trailing tokens after formula");
    return node;
  }

  private additive(): AstNode {
    let node = this.multiplicative();
    for (;;) {
      const t = this.tokens[this.pos];
      if (t?.kind === "op" && (t.op === "+" || t.op === "-")) {
        this.pos++;
        node = { kind: "bin", op: t.op, left: node, right: this.multiplicative() };
      } else return node;
    }
  }

  private multiplicative(): AstNode {
    let node = this.power();
    for (;;) {
      const t = this.tokens[this.pos];
      if (t?.kind === "op" && (t.op === "*" || t.op === "/" || t.op === "%")) {
        this.pos++;
        node = { kind: "bin", op: t.op, left: node, right: this.power() };
      } else return node;
    }
  }

  private power(): AstNode {
    const base = this.unary();
    const t = this.tokens[this.pos];
    if (t?.kind === "op" && t.op === "^") {
      this.pos++;
      return { kind: "bin", op: "^", left: base, right: this.power() };
    }
    return base;
  }

  private unary(): AstNode {
    const t = this.tokens[this.pos];
    if (t?.kind === "op" && t.op === "-") {
      this.pos++;
      return { kind: "neg", expr: this.unary() };
    }
    return this.primary();
  }

  private primary(): AstNode {
    const t = this.tokens[this.pos++];
    if (!t) throw new Error("unexpected end of formula");
    if (t.kind === "num") return { kind: "num", value: t.value };
    if (t.kind === "ident") {
      const next = this.tokens[this.pos];
      if (next?.kind === "lparen") {
        if (!FN_NAMES.has(t.name)) throw new Error(`unknown function ${t.name}`);
        this.pos++;
        const args: AstNode[] = [];
        const peek = this.tokens[this.pos];
        if (peek?.kind !== "rparen") {
          for (;;) {
            args.push(this.additive());
            const sep = this.tokens[this.pos];
            if (sep?.kind === "comma") {
              this.pos++;
              continue;
            }
            break;
          }
        }
        const close = this.tokens[this.pos++];
        if (close?.kind !== "rparen") throw new Error(`missing ) in ${t.name}()`);
        return { kind: "call", name: t.name, args };
      }
      return { kind: "ref", name: t.name };
    }
    if (t.kind === "lparen") {
      const node = this.additive();
      const close = this.tokens[this.pos++];
      if (close?.kind !== "rparen") throw new Error("missing )");
      return node;
    }
    throw new Error("unexpected token in formula");
  }
}

export function parseFormula(src: string): AstNode {
  if (src.length > 2000) throw new Error("formula too long");
  return new Parser(tokenize(src)).parse();
}

function applyFn(name: string, args: number[]): number {
  switch (name) {
    case "abs":
      if (args.length !== 1) throw new Error("abs takes 1 arg");
      return Math.abs(args[0]!);
    case "round":
      if (args.length !== 1) throw new Error("round takes 1 arg");
      return Math.round(args[0]!);
    case "ceil":
      if (args.length !== 1) throw new Error("ceil takes 1 arg");
      return Math.ceil(args[0]!);
    case "floor":
      if (args.length !== 1) throw new Error("floor takes 1 arg");
      return Math.floor(args[0]!);
    case "min":
      if (args.length === 0) throw new Error("min needs args");
      return Math.min(...args);
    case "max":
      if (args.length === 0) throw new Error("max needs args");
      return Math.max(...args);
    default:
      throw new Error(`unknown function ${name}`);
  }
}

// Evaluation step budget: every node visit costs one step. Single formulas
// are bounded by the 2000-char input limit, but the budget makes termination
// unconditional and gives multi-formula evaluation a shared cap. Thread one
// budget through a batch; each evaluate() call without one gets its own.
export const MAX_EVAL_STEPS = 100000;

export class StepBudget {
  private used = 0;
  constructor(private readonly max: number = MAX_EVAL_STEPS) {}
  spend(n = 1): void {
    this.used += n;
    if (this.used > this.max) throw new Error(`formula evaluation exceeded ${this.max} steps`);
  }
  get spent(): number {
    return this.used;
  }
}

export function evaluate(node: AstNode, context: Record<string, unknown>, budget?: StepBudget): Value {
  const b = budget ?? new StepBudget();
  b.spend();
  switch (node.kind) {
    case "num":
      return node.value;
    case "ref": {
      const raw = context[node.name];
      if (raw === null || raw === undefined || raw === "") return null;
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n)) throw new Error(`ref ${node.name} is not numeric`);
      return n;
    }
    case "neg": {
      const v = evaluate(node.expr, context, b);
      return v === null ? null : -v;
    }
    case "bin": {
      const l = evaluate(node.left, context, b);
      const r = evaluate(node.right, context, b);
      if (l === null || r === null) return null;
      switch (node.op) {
        case "+":
          return l + r;
        case "-":
          return l - r;
        case "*":
          return l * r;
        case "/":
          if (r === 0) throw new Error("division by zero");
          return l / r;
        case "%":
          if (r === 0) throw new Error("division by zero");
          return l % r;
        case "^": {
          const v = Math.pow(l, r);
          if (!Number.isFinite(v)) throw new Error("exponent overflow");
          return v;
        }
        default:
          throw new Error(`unknown operator ${node.op}`);
      }
    }
    case "call": {
      const args: number[] = [];
      for (const a of node.args) {
        const v = evaluate(a, context, b);
        if (v === null) return null;
        args.push(v);
      }
      return applyFn(node.name, args);
    }
  }
}

export function evaluateFormula(src: string, context: Record<string, unknown>): Value {
  return evaluate(parseFormula(src), context);
}

export function roundTo(value: number, precision: number): number {
  const f = Math.pow(10, precision);
  return Math.round(value * f) / f;
}

// Dependency analysis for multi-formula evaluation (measures, derived
// properties): collect referenced names, then topologically order a batch so
// each formula sees the outputs of the ones it depends on. Cycles are a
// hard error — derived values must form a DAG, never a loop.
export function collectRefs(node: AstNode, into: Set<string> = new Set()): Set<string> {
  switch (node.kind) {
    case "num":
      return into;
    case "ref":
      into.add(node.name);
      return into;
    case "neg":
      return collectRefs(node.expr, into);
    case "bin":
      collectRefs(node.left, into);
      return collectRefs(node.right, into);
    case "call":
      for (const a of node.args) collectRefs(a, into);
      return into;
  }
}

export function orderFormulas(names: string[], deps: Map<string, Set<string>>): string[] {
  const order: string[] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (name: string, stack: string[]): void => {
    const s = state.get(name);
    if (s === "done") return;
    if (s === "visiting") throw new Error(`formula cycle detected: ${[...stack, name].join(" -> ")}`);
    state.set(name, "visiting");
    for (const dep of deps.get(name) ?? []) {
      if (deps.has(dep)) visit(dep, [...stack, name]);
    }
    state.set(name, "done");
    order.push(name);
  };
  for (const name of names) visit(name, []);
  return order;
}
