export const CANONICAL_FIELDS = [
  "loadId",
  "date",
  "origin",
  "destination",
  "driver",
  "truck",
  "revenue",
  "miles",
  "broker",
  "detention",
  "gallons",
  "amount",
  "station",
  "fee",
  "paidDate",
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

const ALIASES: Record<CanonicalField, string[]> = {
  loadId: ["load id", "load #", "loadno", "load number", "loadref", "load ref", "reference", "ref"],
  date: ["pickupdate", "pickup date", "tripdate", "trip date", "day", "paiddate", "paydate"],
  origin: ["pickup", "pick up", "from", "shipper", "origin city"],
  destination: ["dest", "delivery", "dropoff", "drop off", "to", "consignee", "destination city"],
  driver: ["drivername", "driver name", "operator"],
  truck: ["truckid", "truck id", "unit", "unitno", "unit no", "vehicle", "tractor", "truck no"],
  revenue: ["linehaul", "line haul", "rate", "gross", "settledrevenue", "settled revenue", "total revenue"],
  miles: ["mileage", "distance", "loadedmiles", "loaded miles", "total miles"],
  broker: ["brokername", "broker name", "customer", "3pl", "shipper name"],
  detention: ["detentionpay", "detention pay", "accessorial", "accessorials", "lumper"],
  gallons: ["gals", "qty", "quantity", "volume"],
  amount: ["cost", "totalcost", "total cost", "fuelamount", "fuel amount", "price", "net", "total"],
  station: ["location", "stop", "vendor", "merchant", "fuel stop"],
  fee: ["factorfee", "factor fee", "charge", "servicefee", "service fee", "factoring fee"],
  paidDate: ["paid date", "paydate", "pay date", "settlementdate", "settlement date"],
};

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[m][n];
}

export interface ColumnSuggestion {
  mapping: Partial<Record<CanonicalField, number>>;
  confidence: Partial<Record<CanonicalField, number>>;
  unmapped: number[];
}

export function detectColumns(headers: string[]): ColumnSuggestion {
  const mapping: Partial<Record<CanonicalField, number>> = {};
  const confidence: Partial<Record<CanonicalField, number>> = {};
  const claimedIdx = new Set<number>();
  const claimedField = new Set<CanonicalField>();
  const keys = headers.map(norm);

  const candidates = CANONICAL_FIELDS.flatMap((field) =>
    [field, ...ALIASES[field]].map((a) => ({ field, alias: norm(a) })),
  );

  const passes: Array<(h: string, alias: string) => number | null> = [
    (h, a) => (h === a ? 1 : null),
    (h, a) => (h.length > 2 && a.length > 2 && (h.includes(a) || a.includes(h)) ? 0.8 : null),
    (h, a) =>
      h.length > 4 && a.length > 4 && levenshtein(h, a) <= 2 ? 0.6 : null,
  ];

  for (const pass of passes) {
    keys.forEach((h, idx) => {
      if (claimedIdx.has(idx)) return;
      let best: { field: CanonicalField; conf: number } | null = null;
      for (const c of candidates) {
        if (claimedField.has(c.field)) continue;
        const conf = pass(h, c.alias);
        if (conf !== null && (best === null || conf > best.conf)) {
          best = { field: c.field, conf };
        }
      }
      if (best) {
        mapping[best.field] = idx;
        confidence[best.field] = best.conf;
        claimedIdx.add(idx);
        claimedField.add(best.field);
      }
    });
  }

  const unmapped = keys.map((_, idx) => idx).filter((idx) => !claimedIdx.has(idx));
  return { mapping, confidence, unmapped };
}

export function fingerprint(headers: string[]): string {
  return headers.map(norm).join("|");
}

export function applyMapping(
  headers: string[],
  rows: string[][],
  mapping: Partial<Record<CanonicalField, number>>,
): Array<{ rowNumber: number; record: Record<CanonicalField, string> }> {
  return rows.map((row, i) => {
    const record = {} as Record<CanonicalField, string>;
    for (const field of CANONICAL_FIELDS) {
      const idx = mapping[field];
      record[field] = idx === undefined ? "" : (row[idx] ?? "").trim();
    }
    void headers;
    return { rowNumber: i + 2, record };
  });
}
