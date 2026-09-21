export interface BranchChange {
  objectId: string;
  baseVersion: number;
  data: Record<string, unknown>;
}

export interface MergeOutcome {
  applied: string[];
  conflicts: Array<{ objectId: string; reason: string }>;
}

// Fields carrying interval semantics. Edits to these need coalescing, not
// overwrite — so when main moved under a staged temporal edit, merge refuses
// and routes to rebase instead of guessing.
export const TEMPORAL_FIELDS = new Set(["validFrom", "validTo", "valid_from", "valid_to"]);

// Merge doctrine (binding):
//  1. Fact history (OntoFact validFrom/validTo/txnAt rows) is MERGE-EXEMPT:
//     branch staging and merge touch OntoObject.data only and must never
//     rewrite fact intervals. History is append-only; corrections are new
//     facts, never edits.
//  2. Object-data temporal fields (listed above) merged by overwrite only
//     when main has NOT moved. If main moved and the staged change touches a
//     temporal field while differing from main, that is a conflict with
//     reason "temporal-rebase-required" — the UI must offer rebase, not a
//     field pick, because intervals need coalescing against live state.
//  3. Everything else follows standard three-way rules below.
export function threeWayMerge(
  base: Map<string, { version: number; data: Record<string, unknown> }>,
  main: Map<string, { version: number; data: Record<string, unknown> }>,
  changes: BranchChange[],
  opts: { temporalFields?: Set<string> } = {}
): MergeOutcome {
  const temporal = opts.temporalFields ?? TEMPORAL_FIELDS;
  const applied: string[] = [];
  const conflicts: Array<{ objectId: string; reason: string }> = [];
  for (const c of changes) {
    const b = base.get(c.objectId);
    const m = main.get(c.objectId);
    if (!m) {
      conflicts.push({ objectId: c.objectId, reason: "deleted on main" });
      continue;
    }
    const baseVersion = b?.version ?? c.baseVersion;
    const moved = m.version !== baseVersion;
    const differs = JSON.stringify(m.data) !== JSON.stringify(c.data);
    if (moved && differs) {
      const touchesTemporal = Object.keys(c.data).some((k) => temporal.has(k));
      if (touchesTemporal) {
        conflicts.push({
          objectId: c.objectId,
          reason: `temporal-rebase-required: main at v${m.version}, branch from v${baseVersion}; interval edits need rebase, not overwrite`,
        });
        continue;
      }
      conflicts.push({ objectId: c.objectId, reason: `main at v${m.version}, branch from v${baseVersion}` });
      continue;
    }
    applied.push(c.objectId);
  }
  return { applied, conflicts };
}

export function diffBranches(
  base: Map<string, { version: number }>,
  branch: Map<string, { version: number }>
): { added: string[]; modified: string[]; deleted: string[] } {
  const added = [...branch.keys()].filter((k) => !base.has(k));
  const deleted = [...base.keys()].filter((k) => !branch.has(k));
  const modified = [...branch.keys()].filter((k) => {
    const b = base.get(k);
    const br = branch.get(k)!;
    return b && b.version !== br.version;
  });
  return { added, modified, deleted };
}
