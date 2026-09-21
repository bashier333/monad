import { db } from "@/lib/core/db";
import { createLink, createType, updateType } from "@/lib/core/ontology/registry";
import type { RowPolicy } from "@/lib/core/ontology/policies";

export interface ManufacturingTypeSpec {
  key: string;
  label: string;
  plural: string;
  description: string;
  properties: Array<{
    key: string;
    label: string;
    kind: string;
    required: boolean;
    unique: boolean;
    indexed: boolean;
    immutable: false;
  }>;
}

// Classification marking carried on every manufacturing object.
// Reads filter by clearance (see applyVisibility in service.ts); unknown or
// absent markings are treated as internal.
export const MARKING_PROP = {
  key: "marking",
  label: "Marking",
  kind: "string",
  required: false,
  unique: false,
  indexed: true,
  immutable: false,
} as const;

const MANUFACTURING_BASE_TYPES: ManufacturingTypeSpec[] = [
  {
    key: "mfg_plant",
    label: "Plant",
    plural: "Plants",
    description: "A factory that produces products.",
    properties: [
      { key: "name", label: "Name", kind: "string", required: true, unique: false, indexed: true, immutable: false },
      { key: "region", label: "Region", kind: "string", required: false, unique: false, indexed: true, immutable: false },
      { key: "geopoint", label: "Geopoint", kind: "geo", required: false, unique: false, indexed: false, immutable: false },
      { key: "capacity_units_per_day", label: "Capacity units per day", kind: "number", required: false, unique: false, indexed: false, immutable: false },
      { key: "status", label: "Status", kind: "string", required: false, unique: false, indexed: true, immutable: false },
    ],
  },
  {
    key: "mfg_warehouse",
    label: "Warehouse",
    plural: "Warehouses",
    description: "A warehouse that supplies plants and stocks lots.",
    properties: [
      { key: "name", label: "Name", kind: "string", required: true, unique: false, indexed: true, immutable: false },
      { key: "region", label: "Region", kind: "string", required: false, unique: false, indexed: true, immutable: false },
      { key: "geopoint", label: "Geopoint", kind: "geo", required: false, unique: false, indexed: false, immutable: false },
      { key: "capacity", label: "Capacity", kind: "number", required: false, unique: false, indexed: false, immutable: false },
    ],
  },
  {
    key: "mfg_product",
    label: "Product",
    plural: "Products",
    description: "A sellable SKU.",
    properties: [
      { key: "sku", label: "SKU", kind: "string", required: true, unique: false, indexed: true, immutable: false },
      { key: "name", label: "Name", kind: "string", required: false, unique: false, indexed: true, immutable: false },
      { key: "category", label: "Category", kind: "string", required: false, unique: false, indexed: true, immutable: false },
      { key: "unit_value", label: "Unit value", kind: "currency", required: false, unique: false, indexed: false, immutable: false },
    ],
  },
  {
    key: "mfg_inventory_lot",
    label: "Inventory lot",
    plural: "Inventory lots",
    description: "On-hand quantity of a product at a location.",
    properties: [
      { key: "sku", label: "SKU", kind: "string", required: false, unique: false, indexed: true, immutable: false },
      { key: "warehouse", label: "Warehouse", kind: "string", required: false, unique: false, indexed: true, immutable: false },
      { key: "qty_on_hand", label: "Qty on hand", kind: "integer", required: true, unique: false, indexed: true, immutable: false },
      { key: "safety_stock", label: "Safety stock", kind: "integer", required: false, unique: false, indexed: false, immutable: false },
      { key: "reorder_point", label: "Reorder point", kind: "integer", required: false, unique: false, indexed: true, immutable: false },
      { key: "daily_demand", label: "Daily demand", kind: "number", required: false, unique: false, indexed: false, immutable: false },
    ],
  },
  {
    key: "mfg_shipment",
    label: "Shipment",
    plural: "Shipments",
    description: "A planned, in-transit, delivered, or delayed shipment.",
    properties: [
      { key: "status", label: "Status", kind: "string", required: true, unique: false, indexed: true, immutable: false },
      { key: "carrier", label: "Carrier", kind: "string", required: false, unique: false, indexed: true, immutable: false },
      { key: "eta", label: "ETA", kind: "datetime", required: false, unique: false, indexed: false, immutable: false },
      { key: "qty", label: "Qty", kind: "integer", required: false, unique: false, indexed: false, immutable: false },
      { key: "sla_hours", label: "SLA hours", kind: "number", required: false, unique: false, indexed: false, immutable: false },
    ],
  },
  {
    key: "mfg_customer",
    label: "Customer",
    plural: "Customers",
    description: "A customer that receives shipments.",
    properties: [
      { key: "name", label: "Name", kind: "string", required: true, unique: false, indexed: true, immutable: false },
      { key: "region", label: "Region", kind: "string", required: false, unique: false, indexed: true, immutable: false },
      { key: "tier", label: "Tier", kind: "string", required: false, unique: false, indexed: true, immutable: false },
    ],
  },
];

export const MANUFACTURING_TYPES: ManufacturingTypeSpec[] = MANUFACTURING_BASE_TYPES.map((t) => ({
  ...t,
  properties: [...t.properties, { ...MARKING_PROP }],
}));

export const MANUFACTURING_LINKS: Array<{ key: string; fromTypeKey: string; toTypeKey: string; cardinality: string }> = [
  { key: "mfg_supplies", fromTypeKey: "mfg_warehouse", toTypeKey: "mfg_plant", cardinality: "many-many" },
  { key: "mfg_produces", fromTypeKey: "mfg_plant", toTypeKey: "mfg_product", cardinality: "one-many" },
  { key: "mfg_stocks", fromTypeKey: "mfg_warehouse", toTypeKey: "mfg_inventory_lot", cardinality: "one-many" },
  { key: "mfg_of_product", fromTypeKey: "mfg_inventory_lot", toTypeKey: "mfg_product", cardinality: "one-many" },
  { key: "mfg_origin", fromTypeKey: "mfg_shipment", toTypeKey: "mfg_warehouse", cardinality: "one-many" },
  { key: "mfg_dest_customer", fromTypeKey: "mfg_shipment", toTypeKey: "mfg_customer", cardinality: "one-many" },
  { key: "mfg_dest_plant", fromTypeKey: "mfg_shipment", toTypeKey: "mfg_plant", cardinality: "one-many" },
];

// filterRows denies everything when a type has no policies, so the seed writes
// one allow-all policy per type (empty field + neq matches every row) to keep
// the twin usable while enforcement stays active.
export function defaultAllowPolicy(typeKey: string): { typeKey: string; effect: string; field: string; op: string; value: null; priority: number } {
  return { typeKey, effect: "allow", field: "", op: "neq", value: null, priority: 0 };
}

export async function seedManufacturingOntology(
  organizationId: string,
  createdById: string
): Promise<{ types: number; links: number; policies: number; errors: string[] }> {
  const errors: string[] = [];
  let types = 0;
  for (const t of MANUFACTURING_TYPES) {
    const res = await createType(organizationId, createdById, t);
    if (res.ok) {
      types += 1;
      continue;
    }
    if (res.problems.some((p) => p.message.includes("already exists"))) {
      const updated = await updateType(organizationId, createdById, t.key, t);
      if (updated.ok) types += 1;
      else errors.push(`${t.key}: ${updated.problems.map((p) => p.message).join("; ")}`);
    } else {
      errors.push(`${t.key}: ${res.problems.map((p) => p.message).join("; ")}`);
    }
  }
  let links = 0;
  for (const l of MANUFACTURING_LINKS) {
    const res = await createLink(organizationId, l);
    if (res.ok) links += 1;
    else errors.push(`${l.key}: ${res.problems.map((p) => p.message).join("; ")}`);
  }
  let policies = 0;
  for (const t of MANUFACTURING_TYPES) {
    const existing = await db.ontoPolicy.count({ where: { organizationId, typeKey: t.key, active: true } });
    if (existing === 0) {
      const d = defaultAllowPolicy(t.key);
      await db.ontoPolicy.create({
        data: {
          organizationId,
          typeKey: d.typeKey,
          effect: d.effect,
          field: d.field,
          op: d.op,
          value: d.value as never,
          priority: d.priority,
        },
      });
      policies += 1;
    }
  }
  return { types, links, policies, errors };
}

export const MANUFACTURING_POLICY_PREFIX = "mfg_";

export function toRowPolicies(rows: Array<{ effect: string; field: string; op: string; value: unknown; priority: number }>): RowPolicy[] {
  return rows.map((r) => ({
    effect: r.effect as RowPolicy["effect"],
    field: r.field,
    op: r.op as RowPolicy["op"],
    value: r.value,
    priority: r.priority,
  }));
}
