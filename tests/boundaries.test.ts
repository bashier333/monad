import { readdirSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function sources(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) sources(full, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(full);
  }
  return out;
}

const CORE = path.join(process.cwd(), "lib", "core");

describe("pack boundary rules (X1)", () => {
  it("core never imports from packs", () => {
    const bad: string[] = [];
    for (const f of sources(CORE)) {
      const src = readFileSync(f, "utf8");
      if (/@\/lib\/packs\//.test(src)) bad.push(path.relative(process.cwd(), f));
    }
    expect(bad).toEqual([]);
  });

  it("no file imports from pre-extraction lib paths", () => {
    const dead = ["@/lib/ingest/", "@/lib/corrections/", "@/lib/brief/", "@/lib/answers/", "@/lib/margin/", "@/lib/imports/", "@/lib/rules/validate"];
    const bad: string[] = [];
    for (const f of sources(path.join(process.cwd(), "lib"))) {
      const src = readFileSync(f, "utf8");
      for (const d of dead) {
        if (src.includes(d) && !f.includes("packs/freight/rules-validate")) bad.push(`${path.relative(process.cwd(), f)} imports ${d}`);
      }
    }
    for (const f of sources(path.join(process.cwd(), "app"))) {
      const src = readFileSync(f, "utf8");
      for (const d of dead) {
        if (src.includes(d)) bad.push(`${path.relative(process.cwd(), f)} imports ${d}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
