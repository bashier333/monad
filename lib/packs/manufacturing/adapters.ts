import { registerAdapter, type SourceAdapter } from "@/lib/core/ingest/adapters";
import type { RowIssue } from "@/lib/core/ingest/validate";

// Single source of truth for object keys: the engine normalizer
// (underscores). Payload foreign-key labels (sku, warehouse) use the same
// function so lookups always match stored keys.
import { normalizeKey } from "@/lib/core/ontology/identity";

export { normalizeKey };

export const MANUFACTURING_SOURCE_TYPES = ["erp", "wms", "mes", "manual"] as const;

export type ManufacturingSourceType = (typeof MANUFACTURING_SOURCE_TYPES)[number];

// Column aliases unified per source system: ERP exports product/master data,
// WMS exports lots and stock, MES exports production events.
const ALIASES: Record<string, string[]> = {
  sku: ["sku", "item", "itemno", "item_number", "productcode", "product_code"],
  name: ["name", "title", "description", "itemname", "item_name"],
  category: ["category", "type", "class"],
  unitValue: ["unitvalue", "unit_value", "unitprice", "unit_price", "value", "cost"],
  qtyOnHand: ["qtyonhand", "qty_on_hand", "onhand", "on_hand", "qty", "quantity", "stock"],
  safetyStock: ["safetystock", "safety_stock", "safetylevel"],
  reorderPoint: ["reorderpoint", "reorder_point", "reorder"],
  dailyDemand: ["dailydemand", "daily_demand", "avgdailydemand", "demand"],
  capacity: ["capacity", "capacityunits", "capacity_units"],
  capacityUnitsPerDay: ["capacityunitsperday", "capacity_units_per_day", "dailycapacity"],
  status: ["status", "state", "stage"],
  carrier: ["carrier", "shipper", "scac"],
  eta: ["eta", "estimatedarrival", "estimated_arrival", "expecteddate"],
  slaHours: ["slahours", "sla_hours", "sla"],
  tier: ["tier", "segment", "grade"],
  region: ["region", "area", "zone", "site"],
  plant: ["plant", "factory", "facility"],
  warehouse: ["warehouse", "wh", "dc", "distributioncenter"],
  customer: ["customer", "customername", "customer_name", "account"],
  lot: ["lot", "lotid", "lot_id", "lotnumber"],
  shipment: ["shipment", "shipmentid", "shipment_id", "orderno", "order"],
  id: ["id", "key", "ref", "reference"],
  marking: ["marking", "classification", "sensitivity"],
  geolat: ["geolat", "lat", "latitude"],
  geolng: ["geolng", "lng", "lon", "long", "longitude"],
};

// Builds a geo-kind { lat, lng } payload from a row, or undefined when the
// row carries no usable coordinates. Bounds mirror the engine's geo coercion.
export function geopointOf(r: Record<string, string>): { lat: number; lng: number } | undefined {
  const lat = num(pick(r, "geolat"));
  const lng = num(pick(r, "geolng"));
  if (lat === null || lng === null) return undefined;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined;
  return { lat, lng };
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function aliasFor(header: string): string | null {
  const h = normalizeHeader(header);
  for (const [field, names] of Object.entries(ALIASES)) {
    if (names.includes(h)) return field;
  }
  return null;
}

export function normalizeRow(headers: string[], row: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((h, i) => {
    const field = aliasFor(h);
    if (field === null) return;
    const raw = row[i] ?? "";
    out[field] = typeof raw === "string" ? raw.trim() : String(raw ?? "");
  });
  return out;
}

export type ManufacturingPayloads = {
  plants: Array<{ key: string; data: Record<string, unknown> }>;
  warehouses: Array<{ key: string; data: Record<string, unknown> }>;
  products: Array<{ key: string; data: Record<string, unknown> }>;
  lots: Array<{ key: string; data: Record<string, unknown> }>;
  shipments: Array<{ key: string; data: Record<string, unknown> }>;
  customers: Array<{ key: string; data: Record<string, unknown> }>;
};

function num(v: string | undefined): number | null {
  if (v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[$,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function pick(r: Record<string, string>, field: string): string | undefined {
  const v = r[field];
  return v === undefined || v === "" ? undefined : v;
}

// Maps one normalized source row into ontology object payloads. A single ERP
// row can carry master data for several types at once; WMS rows carry lots;
// MES rows carry production signals.
export function toObjectPayloads(r: Record<string, string>): ManufacturingPayloads {
  const out: ManufacturingPayloads = { plants: [], warehouses: [], products: [], lots: [], shipments: [], customers: [] };
  const plant = pick(r, "plant");
  if (plant) {
    out.plants.push({
      key: normalizeKey(plant),
      data: {
        name: plant,
        region: pick(r, "region"),
        capacity_units_per_day: num(pick(r, "capacityUnitsPerDay")),
        status: pick(r, "status"),
        geopoint: geopointOf(r),
      },
    });
  }
  const warehouse = pick(r, "warehouse");
  if (warehouse) {
    out.warehouses.push({
      key: normalizeKey(warehouse),
      data: { name: warehouse, region: pick(r, "region"), capacity: num(pick(r, "capacity")), geopoint: geopointOf(r) },
    });
  }
  const sku = pick(r, "sku");
  if (sku) {
    out.products.push({
      key: normalizeKey(sku),
      data: { sku, name: pick(r, "name"), category: pick(r, "category"), unit_value: num(pick(r, "unitValue")) },
    });
  }
  if (sku && (pick(r, "qtyOnHand") !== undefined || pick(r, "warehouse") !== undefined)) {
    const lotKey = pick(r, "lot") ? normalizeKey(pick(r, "lot")!) : `${normalizeKey(warehouse ?? "unknown")}-${normalizeKey(sku)}`;
    out.lots.push({
      key: lotKey,
      data: {
        sku: normalizeKey(sku),
        warehouse: warehouse ? normalizeKey(warehouse) : undefined,
        qty_on_hand: num(pick(r, "qtyOnHand")) ?? 0,
        safety_stock: num(pick(r, "safetyStock")),
        reorder_point: num(pick(r, "reorderPoint")),
        daily_demand: num(pick(r, "dailyDemand")),
      },
    });
  }
  const shipment = pick(r, "shipment");
  if (shipment && pick(r, "status") !== undefined) {
    out.shipments.push({
      key: normalizeKey(shipment),
      data: {
        status: pick(r, "status")!,
        carrier: pick(r, "carrier"),
        eta: pick(r, "eta"),
        qty: num(pick(r, "qtyOnHand")),
        sla_hours: num(pick(r, "slaHours")),
        marking: pick(r, "marking"),
      },
    });
  }
  const customer = pick(r, "customer");
  if (customer) {
    out.customers.push({
      key: normalizeKey(customer),
      data: { name: customer, region: pick(r, "region"), tier: pick(r, "tier") },
    });
  }
  return out;
}

const REQUIRED_PER_SOURCE: Record<ManufacturingSourceType, string[]> = {
  erp: ["sku"],
  wms: ["qtyOnHand"],
  mes: ["status"],
  manual: [],
};

export function validateManufacturingRow(
  r: Record<string, string>,
  seen: Set<string>,
  sourceType: string
): RowIssue[] {
  const issues: RowIssue[] = [];
  const required = REQUIRED_PER_SOURCE[(sourceType as ManufacturingSourceType) in REQUIRED_PER_SOURCE ? (sourceType as ManufacturingSourceType) : "manual"];
  for (const f of required) {
    if (pick(r, f) === undefined) issues.push({ field: f, code: "missing_required", message: `${f} is required for ${sourceType} rows` });
  }
  const qty = num(pick(r, "qtyOnHand"));
  if (qty !== null && qty < 0) issues.push({ field: "qtyOnHand", code: "negative_qty", message: "qtyOnHand cannot be negative" });
  const keySeed = pick(r, "lot") ?? pick(r, "sku") ?? pick(r, "shipment") ?? pick(r, "plant") ?? pick(r, "warehouse") ?? pick(r, "customer");
  if (keySeed) {
    const k = normalizeKey(keySeed);
    if (seen.has(k)) issues.push({ field: "key", code: "duplicate", message: `duplicate key ${k}` });
    seen.add(k);
  }
  return issues;
}

export const manufacturingAdapter: SourceAdapter = {
  sourceTypes: [...MANUFACTURING_SOURCE_TYPES],
  detect: (headers) => {
    const mapping: Record<string, number> = {};
    const confidence: Record<string, number> = {};
    headers.forEach((h, i) => {
      const field = aliasFor(h);
      if (field !== null && !(field in mapping)) {
        mapping[field] = i;
        confidence[field] = 1;
      }
    });
    return { mapping, confidence };
  },
  apply: (headers, rows, mapping) =>
    rows.map((row, i) => {
      const record: Record<string, string> = {};
      for (const [field, idx] of Object.entries(mapping)) {
        const raw = row[idx as number] ?? "";
        record[field] = typeof raw === "string" ? raw.trim() : String(raw ?? "");
      }
      return { rowNumber: i + 2, record };
    }),
  validate: (record, seen, sourceType) => validateManufacturingRow(record, seen, sourceType),
  loadKey: (record) => pick(record, "lot") ?? pick(record, "sku") ?? pick(record, "shipment") ?? null,
  dateOf: (record) => pick(record, "eta") ?? "",
};

registerAdapter(manufacturingAdapter);
