export const DEFAULT_ANOMALY_PTS = 6;

export interface BriefAnomaly {
  lane: string;
  swingPts: number;
  direction: "up" | "down";
  causes: string[];
}

export interface NewSince {
  lanes: string[];
  trucks: string[];
  brokers: string[];
}

export interface BriefContent {  schemaVersion: 1;
  weekStart: string;
  weekEnd: string;
  totals: { revenue: number; cost: number; margin: number; marginPct: number | null; loads: number };
  prevTotals: { revenue: number; cost: number; margin: number; marginPct: number | null } | null;
  winners: Array<{ lane: string; margin: number }>;
  losers: Array<{ lane: string; margin: number }>;
  anomalies: BriefAnomaly[];
  openCorrections: number;
  newSince: NewSince;
  recentDecisions: Array<{ load: string; field: string; status: string; reason: string }>;
  paragraph: string;
  laneTotals: Record<string, { margin: number; marginPct: number | null }>;
}
