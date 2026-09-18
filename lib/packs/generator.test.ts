import { execSync } from "child_process";
import { existsSync, rmSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { scaffoldPack } from "@/scripts/new-pack";

const GEN_ID = "gentest";

describe("pack generator (X10 E-459–463/E-460)", () => {
  it("scaffolds a pack that passes typecheck out of the box", () => {
    const root = process.cwd();
    const dir = path.join(root, "lib", "packs", GEN_ID);
    try {
      const files = scaffoldPack({ id: GEN_ID, name: "Generator Proof", group: "job", record: "visit" }, root);
      expect(files.length).toBe(7);
      for (const f of files) expect(existsSync(path.join(root, f))).toBe(true);

      let output = "";
      let exitCode = 0;
      try {
        execSync("npx tsc --noEmit", { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 240000 });
      } catch (e: unknown) {
        exitCode = 1;
        const err = e as { stdout?: string; stderr?: string };
        output = `${err.stdout ?? ""}\n${err.stderr ?? ""}`;
      }
      expect(output).not.toMatch(new RegExp(GEN_ID));
      expect(exitCode).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(path.join(root, "fixtures", `sample-${GEN_ID}.csv`), { force: true });
    }
    expect(existsSync(dir)).toBe(false);
  }, 300000);

  it("rejects bad ids", () => {
    expect(() => scaffoldPack({ id: "Bad ID", name: "x", group: "g", record: "r" }, process.cwd())).toThrow(/slug-case/);
  });
});
