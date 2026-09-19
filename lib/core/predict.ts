import { EVENT_TYPES } from "@/lib/core/events";

export interface ForecastPoint {
  point: number;
  slope: number;
  intercept: number;
  weeks: number;
}

export interface ForecastBands {
  lo: number;
  high: number;
  band: number;
}

export interface ForecastExplanation {
  drivers: string[];
  explanation: string;
}

export interface HistoryPoint {
  weekStart: string;
  margin: number;
}

export interface SummaryGroupLite {
  group?: string;
  key?: string;
  margin: number;
  marginPct: number | null;
  cost: number;
  costByKind: Record<string, number>;
}

export function linearForecast(history: HistoryPoint[]): ForecastPoint {
  const pts = history.filter((h) => Number.isFinite(h.margin));
  if (pts.length === 0) return { point: 0, slope: 0, intercept: 0, weeks: 0 };
  const n = pts.length;
  if (n === 1) return { point: pts[0].margin, slope: 0, intercept: pts[0].margin, weeks: 1 };
  let sx = 0;
  let sy = 0;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sx += i;
    sy += pts[i].margin;
    sxy += i * pts[i].margin;
    sxx += i * i;
  }
  const denom = n * sxx - sx * sx;
  const slope = denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  const point = Math.round((intercept + slope * n) * 100) / 100;
  return { point, slope: Math.round(slope * 100) / 100, intercept: Math.round(intercept * 100) / 100, weeks: n };
}

export function volatility(history: HistoryPoint[]): number {
  const pts = history.map((h) => h.margin);
  if (pts.length < 2) return 0;
  const mean = pts.reduce((s, v) => s + v, 0) / pts.length;
  const variance = pts.reduce((s, v) => s + (v - mean) ** 2, 0) / (pts.length - 1);
  return Math.round(Math.sqrt(variance) * 100) / 100;
}

export function forecastBands(f: ForecastPoint, history: HistoryPoint[]): ForecastBands {
  const sigma = volatility(history);
  const band = Math.max(Math.round(Math.abs(f.slope) * 50), Math.round(sigma * 0.5), 25);
  return { lo: Math.round((f.point - band) * 100) / 100, high: Math.round((f.point + band) * 100) / 100, band };
}

export function explainForecast(f: ForecastPoint, history: HistoryPoint[]): ForecastExplanation {
  const drivers: string[] = [];
  if (f.slope > 0) drivers.push(`trend up ${f.slope}/wk`);
  else if (f.slope < 0) drivers.push(`trend down ${Math.abs(f.slope)}/wk`);
  else drivers.push("flat trend");
  const sigma = volatility(history);
  drivers.push(`volatility ${sigma}`);
  return {
    drivers,
    explanation: `Next week ≈ ${f.point} (${drivers.join(", ")}) from ${f.weeks} week(s) of history. Bands, not points — wide when history is volatile.`,
  };
}

export function mape(cases: Array<{ point: number; actual: number }>): number {
  const valid = cases.filter((c) => c.actual !== 0 && Number.isFinite(c.actual) && Number.isFinite(c.point));
  if (valid.length === 0) return 0;
  const mean = valid.reduce((s, c) => s + Math.abs((c.point - c.actual) / c.actual), 0) / valid.length;
  return Math.round(mean * 10000) / 100;
}

export function backtestForecast(history: HistoryPoint[]): number {
  if (history.length < 3) return 0;
  const cases: Array<{ point: number; actual: number }> = [];
  for (let i = 2; i < history.length; i++) {
    const f = linearForecast(history.slice(0, i));
    cases.push({ point: f.point, actual: history[i].margin });
  }
  return mape(cases);
}

export function computeLearnedThresholds(prevGroups: SummaryGroupLite[]): Record<string, number> {
  const byKey = new Map<string, number[]>();
  for (const g of prevGroups) {
    const key = g.group ?? g.key;
    if (!key || g.marginPct === null || !Number.isFinite(g.marginPct)) continue;
    const list = byKey.get(key) ?? [];
    list.push(g.marginPct);
    byKey.set(key, list);
  }
  const out: Record<string, number> = {};
  for (const [key, pts] of byKey) {
    if (pts.length < 3) continue;
    const mean = pts.reduce((s, v) => s + v, 0) / pts.length;
    const sigma = Math.sqrt(pts.reduce((s, v) => s + (v - mean) ** 2, 0) / (pts.length - 1));
    out[key] = Math.max(3, Math.round(sigma * 2 * 100) / 100);
  }
  return out;
}

export const ANOMALY_WEEKLY_CAP = 5;

export function capAnomalies<T extends { lane: string }>(
  anomalies: T[],
  cap = ANOMALY_WEEKLY_CAP,
): { anomalies: T[]; digestNote: string | null } {
  if (anomalies.length <= cap) return { anomalies, digestNote: null };
  return {
    anomalies: anomalies.slice(0, cap),
    digestNote: `${anomalies.length - cap} more moved — see the full list in anomalies view (alert fatigue guard).`,
  };
}

export const PREDICT_EVENT_TYPES = EVENT_TYPES;
