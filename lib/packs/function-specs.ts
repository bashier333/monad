import { defineFunction } from "@/lib/core/ontology/functions-store";
import type { FunctionSpec } from "@/lib/core/ontology/functions";

// Canonical registry specs (F2-02751..F2-03000, fn1–fn13). Pure data, no DB:
// validated by tests, persisted by seedBuiltinFunctions (idempotent).

export const BUILTIN_FUNCTION_SPECS: FunctionSpec[] = [
  { key: "coverage_days", label: "Coverage days", pure: true, budgetMs: 2000, kind: "native", code: { handler: "coverage_days" }, enabled: true },
  { key: "reorder_suggestion", label: "Reorder suggestion", pure: true, budgetMs: 5000, kind: "native", code: { handler: "reorder_suggestion" }, enabled: true },
  { key: "fulfillment_risk", label: "Fulfillment risk", pure: true, budgetMs: 5000, kind: "native", code: { handler: "fulfillment_risk" }, enabled: true },
  { key: "demand_forecast", label: "Demand forecast", pure: true, budgetMs: 5000, kind: "native", code: { handler: "demand_forecast" }, enabled: true },
  { key: "margin_rollup", label: "Margin rollup", targetTypeKey: "lane", pure: true, budgetMs: 2000, kind: "formula", code: { expression: "revenue - cost" }, enabled: true },
  { key: "margin_percent", label: "Margin percent", targetTypeKey: "lane", pure: true, budgetMs: 2000, kind: "formula", code: { expression: "(revenue - cost) / revenue * 100" }, enabled: true },
  { key: "week_over_week", label: "Week over week", pure: true, budgetMs: 3000, kind: "native", code: { handler: "week_over_week" }, enabled: true },
  { key: "trailing_revenue_30d", label: "Trailing 30-day revenue", pure: true, budgetMs: 3000, kind: "native", code: { handler: "trailing_revenue_30d" }, enabled: true },
  { key: "reorder_point_gap", label: "Reorder point gap", pure: true, budgetMs: 2000, kind: "formula", code: { expression: "reorder_point - qty_on_hand" }, enabled: true },
  { key: "total_exposure", label: "Total exposure", pure: true, budgetMs: 2000, kind: "formula", code: { expression: "qty * unit_value" }, enabled: true },
  { key: "avg_miles", label: "Average miles", pure: true, budgetMs: 3000, kind: "aggregation", code: { op: "avg", field: "miles" }, enabled: true },
  { key: "median_detention", label: "Median detention", pure: true, budgetMs: 3000, kind: "aggregation", code: { op: "median", field: "detention" }, enabled: true },
  { key: "revenue_match", label: "Revenue match", pure: true, budgetMs: 5000, kind: "native", code: { handler: "revenue_match" }, enabled: true },
];

export const EXTENDED_FUNCTION_SPECS: FunctionSpec[] = [
  { key: "top_drivers", label: "Top margin drivers", pure: true, budgetMs: 2000, kind: "native", code: { handler: "top_drivers" }, enabled: true },
  { key: "anomaly_flag", label: "Anomaly flag", pure: true, budgetMs: 3000, kind: "native", code: { handler: "anomaly_flag" }, enabled: true },
  { key: "cost_attribute", label: "Cost attribute", pure: true, budgetMs: 3000, kind: "native", code: { handler: "cost_attribute" }, enabled: true },
  { key: "deadhead_split", label: "Deadhead split", pure: true, budgetMs: 2000, kind: "native", code: { handler: "deadhead_split" }, enabled: true },
  { key: "overhead_split", label: "Overhead split", pure: true, budgetMs: 2000, kind: "native", code: { handler: "overhead_split" }, enabled: true },
  { key: "settlement_fuzzy", label: "Settlement fuzzy candidates", pure: true, budgetMs: 5000, kind: "native", code: { handler: "settlement_fuzzy" }, enabled: true },
  { key: "lane_normalize", label: "Lane normalize", pure: true, budgetMs: 2000, kind: "native", code: { handler: "lane_normalize" }, enabled: true },
  { key: "place_alias", label: "Place alias", pure: true, budgetMs: 2000, kind: "native", code: { handler: "place_alias" }, enabled: true },
  { key: "duplicate_score", label: "Duplicate score", pure: true, budgetMs: 2000, kind: "native", code: { handler: "duplicate_score" }, enabled: true },
  { key: "identity_score", label: "Identity score", pure: true, budgetMs: 2000, kind: "native", code: { handler: "identity_score" }, enabled: true },
  { key: "merge_plan", label: "Merge plan", pure: true, budgetMs: 2000, kind: "native", code: { handler: "merge_plan" }, enabled: true },
  { key: "risk_score", label: "Risk score", pure: true, budgetMs: 2000, kind: "native", code: { handler: "risk_score" }, enabled: true },
  { key: "verdict_score", label: "Verdict score", pure: true, budgetMs: 2000, kind: "native", code: { handler: "verdict_score" }, enabled: true },
  { key: "fuse_flags", label: "Fuse flags", pure: true, budgetMs: 3000, kind: "native", code: { handler: "fuse_flags" }, enabled: true },
  { key: "dedupe_flags", label: "Dedupe flags", pure: true, budgetMs: 3000, kind: "native", code: { handler: "dedupe_flags" }, enabled: true },
  { key: "brief_build", label: "Brief build", pure: true, budgetMs: 5000, kind: "native", code: { handler: "brief_build" }, enabled: true },
  { key: "brief_variant", label: "Brief variant", pure: true, budgetMs: 5000, kind: "native", code: { handler: "brief_variant" }, enabled: true },
  { key: "chart_series", label: "Chart series", pure: true, budgetMs: 2000, kind: "native", code: { handler: "chart_series" }, enabled: true },
  { key: "map_points", label: "Map points", pure: true, budgetMs: 2000, kind: "native", code: { handler: "map_points" }, enabled: true },
  { key: "graph_rank", label: "Graph rank", pure: true, budgetMs: 2000, kind: "native", code: { handler: "graph_rank" }, enabled: true },
  { key: "path_find", label: "Path find", pure: true, budgetMs: 2000, kind: "native", code: { handler: "path_find" }, enabled: true },
  { key: "impact_sim", label: "Impact simulation", pure: true, budgetMs: 5000, kind: "native", code: { handler: "impact_sim" }, enabled: true },
  { key: "scenario_diff", label: "Scenario diff", pure: true, budgetMs: 2000, kind: "native", code: { handler: "scenario_diff" }, enabled: true },
  { key: "approval_quorum", label: "Approval quorum", pure: true, budgetMs: 2000, kind: "native", code: { handler: "approval_quorum" }, enabled: true },
  { key: "notify_list", label: "Notify list", pure: true, budgetMs: 2000, kind: "native", code: { handler: "notify_list" }, enabled: true },
  { key: "webhook_params", label: "Webhook params", pure: true, budgetMs: 2000, kind: "native", code: { handler: "webhook_params" }, enabled: true },
  { key: "derived_metric", label: "Derived metric", pure: true, budgetMs: 2000, kind: "formula", code: { expression: "a * b + c" }, enabled: true },
  { key: "currency_norm", label: "Currency normalize", pure: true, budgetMs: 2000, kind: "native", code: { handler: "currency_norm" }, enabled: true },
  { key: "unit_norm", label: "Unit normalize", pure: true, budgetMs: 2000, kind: "native", code: { handler: "unit_norm" }, enabled: true },
  { key: "week_bounds", label: "Week bounds", pure: true, budgetMs: 2000, kind: "native", code: { handler: "week_bounds" }, enabled: true },
  { key: "freshness_check", label: "Freshness check", pure: true, budgetMs: 2000, kind: "native", code: { handler: "freshness_check" }, enabled: true },
  { key: "eval_metric", label: "Eval metric", pure: true, budgetMs: 2000, kind: "native", code: { handler: "eval_metric" }, enabled: true },
  { key: "trace_link", label: "Trace link", pure: true, budgetMs: 2000, kind: "native", code: { handler: "trace_link" }, enabled: true },
];

export async function seedBuiltinFunctions(
  organizationId: string,
  actorId: string,
): Promise<{ created: string[]; skipped: string[] }> {
  const created: string[] = [];
  const skipped: string[] = [];
  for (const spec of [...BUILTIN_FUNCTION_SPECS, ...EXTENDED_FUNCTION_SPECS]) {
    const res = await defineFunction(organizationId, actorId, spec);
    if (res.ok) created.push(spec.key);
    else skipped.push(spec.key);
  }
  return { created, skipped };
}
