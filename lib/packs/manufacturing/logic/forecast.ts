import { explainForecast, forecastBands, linearForecast, type HistoryPoint } from "@/lib/core/predict";

export interface DemandForecast {
  point: number;
  slope: number;
  weeks: number;
  bands: { lo: number; high: number; band: number };
  explanation: string;
}

// Deterministic OLS demand forecast reusing the platform's predict module.
export function demandForecast(history: Array<{ weekStart: string; demand: number }>): DemandForecast | null {
  if (history.length < 2) return null;
  const points: HistoryPoint[] = history.map((h) => ({ weekStart: h.weekStart, margin: h.demand }));
  const f = linearForecast(points);
  const bands = forecastBands(f, points);
  const { explanation } = explainForecast(f, points);
  return { point: f.point, slope: f.slope, weeks: f.weeks, bands, explanation };
}
