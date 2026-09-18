import type { AgencyLoadMargin, ProjectMargin } from "@/lib/packs/agency/engine";

function cell(v: string | number | null): string {
  let s = v === null ? "" : String(v);
  if (/^[=+\-@|\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildAgencyExportCSV(
  projects: ProjectMargin[],
  loads: AgencyLoadMargin[],
  projectFilter: string | null,
): string {
  const lines: string[] = [];
  lines.push("project,client,revisions,revenue,cost,margin,margin_pct");
  for (const p of projects) {
    if (projectFilter && p.project !== projectFilter) continue;
    lines.push(
      [p.project, p.client, p.revisions, p.revenue, p.cost, p.margin, p.marginPct ?? ""].map(cell).join(","),
    );
  }
  lines.push("");
  lines.push("record,date,project,client,person,task,hours,total_cost,margin,cost_kind,cost_label,cost_amount,cost_rule,source_file,source_rows");
  for (const lm of loads) {
    if (projectFilter && lm.project !== projectFilter) continue;
    if (lm.costs.length === 0) {
      lines.push(
        [lm.loadKey, lm.date, lm.project, lm.client, lm.person, lm.task, lm.hours, lm.totalCost, lm.margin, "", "", "", "", "", ""].map(cell).join(","),
      );
    }
    for (const c of lm.costs) {
      lines.push(
        [lm.loadKey, lm.date, lm.project, lm.client, lm.person, lm.task, lm.hours, lm.totalCost, lm.margin, c.kind, c.label, c.amount, c.ruleId, c.source.fileName, c.source.rowNumbers.join(";")].map(cell).join(","),
      );
    }
  }
  return lines.join("\n");
}
