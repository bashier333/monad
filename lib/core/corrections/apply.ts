import type { AppliedCorrection } from "@/lib/core/corrections/rules";

export interface CostSource {
  runId: string;
  fileName: string;
  rowNumbers: number[];
}

export interface CostLine {
  kind: string;
  label: string;
  amount: number;
  ruleId: string;
  source: CostSource;
}

export interface CostedRecord {
  key?: string;
  costs: CostLine[];
}

export function applyCorrectionsToRecords<T extends CostedRecord>(
  records: Map<string, T>,
  corrections: AppliedCorrection[],
): Array<{ correctionId: string; description: string }> {
  const adjustments: Array<{ correctionId: string; description: string }> = [];
  for (const c of corrections) {
    const from = records.get(c.fromLoad);
    if (!from) continue;
    const idx = from.costs.findIndex((cl) => cl.kind === c.costKind);
    if (idx === -1) continue;
    const [line] = from.costs.splice(idx, 1);
    let dest: string | null = c.toLoad;
    let pct = 1;
    if (dest && dest.includes(":")) {
      const [target, share] = dest.split(":");
      const p = Number(share);
      if (!target || Number.isNaN(p) || p <= 0 || p >= 100) {
        from.costs.push(line);
        continue;
      }
      dest = target;
      pct = p / 100;
    }
    if (dest) {
      const to = records.get(dest);
      if (to) {
        const moved = Math.round(line.amount * pct * 100) / 100;
        const left = Math.round((line.amount - moved) * 100) / 100;
        to.costs.push({ ...line, amount: moved, ruleId: `corr:${c.id}` });
        if (left > 0) from.costs.push({ ...line, amount: left });
        adjustments.push({ correctionId: c.id, description: `moved ${c.costKind} $${moved} from ${c.fromLoad} to ${dest}: ${c.reason}` });
      } else {
        from.costs.push(line);
        continue;
      }
    } else {
      adjustments.push({ correctionId: c.id, description: `excluded ${c.costKind} $${line.amount} from ${c.fromLoad}: ${c.reason}` });
    }
  }
  return adjustments;
}
