import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe(".env.example hygiene (S-623)", () => {
  it("contains zero real values", () => {
    const src = readFileSync(path.join(process.cwd(), ".env.example"), "utf8");
    expect(src).not.toMatch(/sk_live_[A-Za-z0-9]+/);
    expect(src).not.toMatch(/sk_test_[A-Za-z0-9]{10,}/);
    expect(src).not.toMatch(/whsec_[A-Za-z0-9]{10,}/);
    expect(src).not.toMatch(/re_[A-Za-z0-9]{10,}/);
    for (const line of src.split("\n")) {
      const m = line.match(/=\s*"([^"]*)"/);
      if (!m) continue;
      const v = m[1];
      if (/^(https?:\/\/|postgresql:\/\/)/.test(v)) continue;
      if (v === "") continue;
      if (/generate-with|example|placeholder|your-|login@|localhost/.test(v)) continue;
      expect(v.length, line).toBeLessThan(32);
    }
  });
});
