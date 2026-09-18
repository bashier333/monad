// Pack generator (X10 E-459–463, E-465, E-467) — scaffolds a new vertical pack
// from answers: entities/measures/rules/tests/fixtures/docs/demo seed.
// Usage: npx tsx scripts/new-pack.ts --id dental --name "Dental clinics" --group job
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

export interface PackSpec {
  id: string;
  name: string;
  group: string;
  record: string;
}

export function scaffoldPack(spec: PackSpec, root: string): string[] {
  if (!/^[a-z0-9-]+$/.test(spec.id)) throw new Error(`id must be slug-case: ${spec.id}`);
  if (!spec.name || !spec.group || !spec.record) throw new Error("name/group/record are required");
  const dir = path.join(root, "lib", "packs", spec.id);
  mkdirSync(path.join(dir, "brief"), { recursive: true });
  mkdirSync(path.join(root, "fixtures"), { recursive: true });
  const files: string[] = [];

  const write = (rel: string, content: string) => {
    const full = path.join(root, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content);
    files.push(rel);
  };

  const G = spec.group;
  const R = spec.record;

  write(`lib/packs/${spec.id}/manifest.ts`, `import type { PackManifest } from "@/lib/packs/manifest";

export const ${constName(spec.id)}_MANIFEST: PackManifest = {
  id: "${spec.id}",
  name: "${spec.name}",
  version: 1,
  entities: ["${G}", "${R}"],
  sources: ["export"],
  vocabulary: { group: "${G}", groups: "${G}s", record: "${R}", records: "${R}s", period: "week", money: "margin" },
  migrationNotes: ["v1: scaffolded by scripts/new-pack.ts; replace stub engine before pilot."],
};
`);

  write(`lib/packs/${spec.id}/fields.ts`, `export const ${constName(spec.id)}_FIELDS = ["key", "${G}", "date", "amount"] as const;

export type ${typeName(spec.id)}Field = (typeof ${constName(spec.id)}_FIELDS)[number];

export const ${constName(spec.id)}_ALIASES: Record<${typeName(spec.id)}Field, string[]> = {
  key: ["id", "ref", "reference"],
  ${G}: ["name", "title"],
  date: ["day", "created"],
  amount: ["total", "cost", "price"],
};
`);

  write(`lib/packs/${spec.id}/engine.ts`, `export interface ${typeName(spec.id)}Input {
  key: string;
  ${G}: string;
  date: string;
  amount: string;
}

export interface ${typeName(spec.id)}Group {
  ${G}: string;
  records: number;
  cost: number;
}

export function compute${typeName(spec.id)}Groups(records: ${typeName(spec.id)}Input[]): ${typeName(spec.id)}Group[] {
  const byGroup = new Map<string, ${typeName(spec.id)}Group>();
  for (const r of records) {
    if (!r.${G}) continue;
    const g = byGroup.get(r.${G}) ?? { ${G}: r.${G}, records: 0, cost: 0 };
    g.records++;
    const n = Number(String(r.amount).replace(/[$,]/g, ""));
    g.cost = Math.round((g.cost + (Number.isNaN(n) ? 0 : n)) * 100) / 100;
    byGroup.set(r.${G}, g);
  }
  return [...byGroup.values()].sort((a, b) => a.cost - b.cost);
}
`);

  write(`lib/packs/${spec.id}/nl.ts`, `import { parseQueryGeneric, type NlIntent, type NlPackConfig } from "@/lib/core/answers/nl";

export type { NlIntent };

export const ${constName(spec.id)}_NL: NlPackConfig = {
  entityWord: "${G}",
  topics: [
    { topic: "losers", patterns: ["lost", "losing", "worst", "unprofitable"] },
    { topic: "winners", patterns: ["best", "winning", "most profitable", "top"] },
  ],
};

export function parse${typeName(spec.id)}Query(raw: string): NlIntent {
  return parseQueryGeneric(raw, ${constName(spec.id)}_NL);
}
`);

  write(`lib/packs/${spec.id}/manifest.test.ts`, `import { describe, expect, it } from "vitest";
import { validatePackManifest } from "@/lib/packs/manifest";
import { ${constName(spec.id)}_MANIFEST } from "@/lib/packs/${spec.id}/manifest";
import { compute${typeName(spec.id)}Groups } from "@/lib/packs/${spec.id}/engine";
import { parse${typeName(spec.id)}Query } from "@/lib/packs/${spec.id}/nl";

describe("${spec.id} pack scaffold", () => {
  it("manifest validates", () => {
    expect(validatePackManifest(${constName(spec.id)}_MANIFEST)).toEqual([]);
  });

  it("engine groups records", () => {
    const groups = compute${typeName(spec.id)}Groups([
      { key: "1", ${G}: "A", date: "2026-09-07", amount: "100" },
      { key: "2", ${G}: "A", date: "2026-09-08", amount: "50" },
    ]);
    expect(groups).toEqual([{ ${G}: "A", records: 2, cost: 150 }]);
  });

  it("nl parses a loser query", () => {
    expect(parse${typeName(spec.id)}Query("worst ${G}")).toMatchObject({ view: "lanes", topic: "losers" });
  });
});
`);

  write(`lib/packs/${spec.id}/README.md`, `# ${spec.name} pack (scaffolded)

Replace this stub before any pilot: real ontology, rules with sentences,
fixtures in \`fixtures/sample-${spec.id}.csv\`, demo seed entry, docs.
See \`docs/pack-system.md\` and the pack-authoring guide v2 (E-465: this file).
`);

  write(`fixtures/sample-${spec.id}.csv`, `Name,Date,Amount\nA,2026-09-07,100\nA,2026-09-08,50\n`);

  return files;
}

function constName(id: string): string {
  return id.replace(/[^a-z0-9]+/gi, "_").toUpperCase();
}

function typeName(id: string): string {
  return id
    .split(/[^a-z0-9]+/gi)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join("");
}

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [[m[1], m[2]]] : [];
  }),
);

if (process.argv.length > 2) {
  const files = scaffoldPack(
    { id: args.id, name: args.name, group: args.group ?? "project", record: args.record ?? "record" },
    process.cwd(),
  );
  console.log(`scaffolded pack ${args.id}:`);
  for (const f of files) console.log(`  ${f}`);
}
