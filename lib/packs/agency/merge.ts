import { normalizeName } from "@/lib/core/names";

export interface AgencyJoinRow {
  sourceType: string;
  project: string;
  date: string;
  person: string;
  task: string;
  hours: string;
  amount: string;
  runId: string;
  rowNumber: number;
}

export interface HourConflict {
  project: string;
  person: string;
  date: string;
  task: string;
  hoursA: number;
  hoursB: number;
  runA: string;
  runB: string;
}

export interface AgencyJoinResult {
  projects: string[];
  unmatchedRevenue: Array<{ project: string; amount: number }>;
  hourConflicts: HourConflict[];
}

function num(v: string): number {
  const n = Number(v.replace(/[$,]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

export function joinAgencyByProject(rows: AgencyJoinRow[], aliases: Map<string, string>): AgencyJoinResult {
  const timeProjects = new Set<string>();
  const timeKeys = new Map<string, { hours: number; runId: string; rowNumber: number }>();
  const hourConflicts: HourConflict[] = [];
  const revenueByProject = new Map<string, number>();

  for (const r of rows) {
    const project = normalizeName(r.project, aliases);
    if (!project) continue;
    if (r.sourceType === "invoice") {
      const amount = num(r.amount);
      if (amount !== 0) revenueByProject.set(project, (revenueByProject.get(project) ?? 0) + amount);
      continue;
    }
    if (r.sourceType !== "time") continue;
    timeProjects.add(project);
    const key = `${project}|${r.person}|${r.date}|${r.task}`;
    const hours = num(r.hours);
    const prior = timeKeys.get(key);
    if (prior && prior.hours !== hours) {
      hourConflicts.push({
        project,
        person: r.person,
        date: r.date,
        task: r.task,
        hoursA: prior.hours,
        hoursB: hours,
        runA: prior.runId,
        runB: r.runId,
      });
    } else if (!prior) {
      timeKeys.set(key, { hours, runId: r.runId, rowNumber: r.rowNumber });
    }
  }

  const unmatchedRevenue: AgencyJoinResult["unmatchedRevenue"] = [];
  for (const [project, amount] of revenueByProject) {
    if (!timeProjects.has(project)) unmatchedRevenue.push({ project, amount });
  }

  return { projects: [...timeProjects].sort(), unmatchedRevenue, hourConflicts };
}
