export interface PriorStaged {
  runId: string;
  loadKey: string;
  data: Record<string, string>;
}

export interface MergeConflict {
  loadKey: string;
  field: string;
  ours: string;
  theirs: string;
  theirRunId: string;
}

function normVal(v: string): string {
  return v.trim().toLowerCase().replace(/[$,]/g, "");
}

export function findConflicts(
  current: Map<string, Record<string, string>>,
  prior: PriorStaged[],
): MergeConflict[] {
  const conflicts: MergeConflict[] = [];
  for (const p of prior) {
    const ours = current.get(p.loadKey);
    if (!ours) continue;
    for (const [field, theirVal] of Object.entries(p.data)) {
      const ourVal = ours[field] ?? "";
      if (!theirVal || !ourVal) continue;
      if (normVal(theirVal) !== normVal(ourVal)) {
        conflicts.push({ loadKey: p.loadKey, field, ours: ourVal, theirs: theirVal, theirRunId: p.runId });
      }
    }
  }
  return conflicts;
}
