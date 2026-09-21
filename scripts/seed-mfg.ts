// Manufacturing operational model seeder. Seeds the ontology (types, links,
// policies) + governed actions, then imports the fixture CSVs through the
// manufacturing adapter into the object graph.
// Usage: npx tsx scripts/seed-mfg.ts [--org=<organizationId>] [--actor=<userId>]
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import { db } from "../lib/core/db";
import { normalizeKey, normalizeRow, toObjectPayloads } from "../lib/packs/manufacturing/adapters";
import { upsertObject } from "../lib/core/ontology/objects";
import { createEdgeInstance } from "../lib/core/ontology/edges";
import { seedManufacturingPack } from "../lib/packs/manufacturing/service";

const FIXTURES = [
  "mfg-plants.csv",
  "mfg-warehouses.csv",
  "mfg-inventory.csv",
  "mfg-shipments.csv",
  "mfg-customers.csv",
] as const;

const TYPE_OF: Record<string, string> = {
  plants: "mfg_plant",
  warehouses: "mfg_warehouse",
  products: "mfg_product",
  lots: "mfg_inventory_lot",
  shipments: "mfg_shipment",
  customers: "mfg_customer",
};

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).flatMap((a) => {
      const m = a.match(/^--([^=]+)=(.*)$/);
      return m ? [[m[1], m[2]]] : [];
    }),
  );
  const org = args.org
    ? await db.organization.findUnique({ where: { id: args.org } })
    : await db.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) {
    console.log("seed-mfg: no organization found (pass --org=<id>)");
    return;
  }
  const actor = args.actor
    ? args.actor
    : (
        await db.membership.findFirst({
          where: { organizationId: org.id },
          select: { userId: true },
          orderBy: { createdAt: "asc" },
        })
      )?.userId ?? "";
  console.log(`seed-mfg: org ${org.id}, actor ${actor || "(none)"}`);

  const seed = await seedManufacturingPack(org.id, actor);
  console.log(
    `seed-mfg: ontology types=${seed.ontology.types} links=${seed.ontology.links} policies=${seed.ontology.policies} actions=${seed.actions.filter((a) => a.ok).length}/${seed.actions.length}`,
  );
  for (const e of seed.ontology.errors) console.log(`  seed warning: ${e}`);

  const idsByKey = new Map<string, string>();
  const typeKeys = new Set((await db.ontoType.findMany({ where: { organizationId: org.id }, select: { key: true } })).map((t) => t.key));
  for (const fixture of FIXTURES) {
    const raw = readFileSync(`fixtures/${fixture}`, "utf8");
    const rows = parse(raw, { skip_empty_lines: true }) as string[][];
    if (rows.length < 2) continue;
    const headers = rows[0]!.map((h) => String(h));
    let created = 0;
    let skipped = 0;
    for (const row of rows.slice(1)) {
      const record = normalizeRow(headers, row);
      const payloads = toObjectPayloads(record);
      for (const [bucket, typeKey] of Object.entries(TYPE_OF)) {
        for (const p of (payloads as unknown as Record<string, Array<{ key: string; data: Record<string, unknown> }>>)[bucket] ?? []) {
          if (!typeKeys.has(typeKey)) continue;
          if (!p.data || Object.keys(p.data).length === 0) continue;
          const res = await upsertObject(org.id, typeKey, { key: p.key, data: p.data });
          if (res.ok) {
            idsByKey.set(`${typeKey}:${p.key}`, res.value.id);
            created += 1;
          } else if (res.error === "duplicate key") {
            skipped += 1;
          } else {
            console.log(`  ${typeKey} ${p.key}: ${res.error}`);
          }
        }
      }
    }
    console.log(`seed-mfg: ${fixture} created=${created} duplicates=${skipped}`);
  }

  // Wire the supply-chain edges from natural keys found in the fixtures.
  const edges: Array<{ from: string; link: string; to: string }> = [];
  const lotsRaw = await db.ontoObject.findMany({ where: { organizationId: org.id, typeKey: "mfg_inventory_lot", deletedAt: null } });
  const productsRaw = await db.ontoObject.findMany({ where: { organizationId: org.id, typeKey: "mfg_product", deletedAt: null } });
  const warehousesRaw = await db.ontoObject.findMany({ where: { organizationId: org.id, typeKey: "mfg_warehouse", deletedAt: null } });
  const plantsRaw = await db.ontoObject.findMany({ where: { organizationId: org.id, typeKey: "mfg_plant", deletedAt: null } });
  const skuToProduct = new Map(productsRaw.map((p) => [p.key, p.id]));
  const whByKey = new Map(warehousesRaw.map((w) => [w.key, w.id]));
  for (const [k, v] of idsByKey) {
    if (k.startsWith("mfg_warehouse:") && !whByKey.has(k.slice("mfg_warehouse:".length))) whByKey.set(k.slice("mfg_warehouse:".length), v);
  }
  for (const lot of lotsRaw) {
    const data = lot.data as Record<string, unknown>;
    const sku = typeof data.sku === "string" ? data.sku : null;
    const whKey = typeof data.warehouse === "string" ? data.warehouse : null;
    if (sku && skuToProduct.has(sku)) edges.push({ from: lot.id, link: "mfg_of_product", to: skuToProduct.get(sku)! });
    if (whKey && whByKey.has(whKey)) edges.push({ from: whByKey.get(whKey)!, link: "mfg_stocks", to: lot.id });
  }
  // Warehouses supply plants in the same region.
  const regionOf = (data: unknown) => {
    const r = (data as Record<string, unknown>).region;
    return typeof r === "string" ? r.toLowerCase() : "";
  };
  for (const wh of warehousesRaw) {
    for (const plant of plantsRaw) {
      if (regionOf(wh.data) && regionOf(wh.data) === regionOf(plant.data)) {
        edges.push({ from: wh.id, link: "mfg_supplies", to: plant.id });
      }
    }
  }

  // Shipment origin/destination edges straight from the fixture columns.
  const shipRaw = readFileSync("fixtures/mfg-shipments.csv", "utf8");
  const shipRows = parse(shipRaw, { skip_empty_lines: true }) as string[][];
  if (shipRows.length >= 2) {
    const shipHeaders = shipRows[0]!.map((h) => String(h).toLowerCase().trim());
    const col = (name: string) => shipHeaders.findIndex((h) => h === name);
    const sIdx = col("shipment");
    const oIdx = col("origin");
    const cIdx = col("customer");
    const pIdx = col("destplant");
    for (const row of shipRows.slice(1)) {
      const shipKey = normalizeKey(String(row[sIdx] ?? ""));
      const shipId = idsByKey.get(`mfg_shipment:${shipKey}`);
      if (!shipId) continue;
      const originKey = normalizeKey(String(row[oIdx] ?? ""));
      const custKey = normalizeKey(String(row[cIdx] ?? ""));
      const plantKey = normalizeKey(String(row[pIdx] ?? ""));
      const originId = idsByKey.get(`mfg_warehouse:${originKey}`);
      if (originId) edges.push({ from: shipId, link: "mfg_origin", to: originId });
      const custId = idsByKey.get(`mfg_customer:${custKey}`);
      if (custId) edges.push({ from: shipId, link: "mfg_dest_customer", to: custId });
      const destPlantId = idsByKey.get(`mfg_plant:${plantKey}`);
      if (destPlantId) edges.push({ from: shipId, link: "mfg_dest_plant", to: destPlantId });
    }
  }

  let wired = 0;
  for (const e of edges) {
    try {
      await createEdgeInstance(org.id, e.from, e.link, e.to);
      wired += 1;
    } catch {
      // duplicate edge
    }
  }
  console.log(`seed-mfg: edges wired=${wired}`);
  console.log("seed-mfg: done");
}

void main();
