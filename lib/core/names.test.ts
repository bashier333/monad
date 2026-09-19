import { describe, expect, it } from "vitest";
import { normalizeName, normalizeText } from "@/lib/core/names";

describe("unicode-safe normalization (S-261/S-262/S-264/S-267/S-268)", () => {
  it("NFC/NFD collide to the same key", () => {
    const nfc = "Café";
    const nfd = "Café";
    expect(normalizeText(nfc)).toBe(normalizeText(nfd));
    expect(normalizeName(nfc, new Map())).toBe("CAFE");
  });

  it("zero-width + RTL overrides stripped", () => {
    expect(normalizeText("Ac\u200Bme")).toBe("ACME");
    expect(normalizeText("Ac\u202Eme")).toBe("ACME");
    expect(normalizeText("Ac\uFEFFme")).toBe("ACME");
  });

  it("invalid surrogates dropped, never stored", () => {
    expect(normalizeText("A\ud800B")).toBe("AB");
  });

  it("emoji preserved through matching pipeline (stored safely, inert in UI)", () => {
    expect(normalizeText("Job 🎬 Night")).toBe("JOB NIGHT");
  });

  it("case folding consistent incl. Turkish dotless i", () => {
    expect(normalizeText("DİYARBAKIR".toLowerCase())).toBe(normalizeText("DIYARBAKIR"));
  });
});
