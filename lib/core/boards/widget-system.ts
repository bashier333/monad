// Embed + scenario widget contracts (iframe, embedded-module, drag-drop,
// app-pairing, commands, scenario-*, mobile-*). Pure, testable, no DOM.

// ---------------------------------------------------------------------------
// Embed guard: iframe / embedded-module widgets may only load allowlisted
// https origins. Anything else fails closed with a reason — never renders.
// ---------------------------------------------------------------------------

export function validateEmbedUrl(
  url: string,
  allowlist: string[],
): { ok: true; origin: string } | { ok: false; error: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: "embed src must be a valid URL" };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, error: "embed src must be https" };
  }
  const origin = parsed.origin.toLowerCase();
  const allowed = allowlist.map((a) => a.toLowerCase());
  if (!allowed.includes(origin)) {
    return { ok: false, error: `embed origin ${origin} is not allowlisted` };
  }
  return { ok: true, origin };
}

// ---------------------------------------------------------------------------
// Scenario flow: scenario-manager stages BranchChange-shaped edits,
// impact_sim previews them, scenario_diff summarizes, mergeBranch commits.
// This helper proves the three shapes line up without a database.
// ---------------------------------------------------------------------------

export interface ScenarioChange {
  objectId: string;
  data: Record<string, unknown>;
}

export function summarizeScenarioFlow(
  changes: ScenarioChange[],
  before: Record<string, Record<string, unknown>>,
  after: Record<string, Record<string, unknown>>,
): {
  staged: number;
  diff: Array<{ field: string; before: unknown; after: unknown }>;
  affectedObjects: string[];
} {
  const diff: Array<{ field: string; before: unknown; after: unknown }> = [];
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const b = before[k] ?? null;
    const a = after[k] ?? null;
    if (JSON.stringify(b) !== JSON.stringify(a)) diff.push({ field: k, before: b, after: a });
  }
  return {
    staged: changes.length,
    diff,
    affectedObjects: [...new Set(changes.map((c) => c.objectId))],
  };
}
