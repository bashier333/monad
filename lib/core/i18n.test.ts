import { describe, expect, it } from "vitest";
import { formatDate, formatMoney, isLocale, SUPPORTED_LOCALES, t } from "@/lib/core/i18n";

describe("i18n foundation (R-081/R-082)", () => {
  it("translates key strings, falls back to en", () => {
    expect(t("en", "answers.title")).toBe("Lane margins");
    expect(t("es", "answers.title")).toBe("Márgenes por ruta");
    expect(t("de", "nav.upload")).toBe("Hochladen");
    expect(t("fr", "nav.upload")).toBe("Upload");
    expect(t("es", "missing.key")).toBe("missing.key");
    expect(SUPPORTED_LOCALES).toEqual(["en", "es", "de"]);
  });

  it("formats money/date per locale", () => {
    expect(formatMoney(1200.5, "en")).toMatch(/1,200/);
    expect(formatMoney(1200.5, "de")).toMatch(/1\.200/);
    expect(formatDate("2026-09-07", "en")).toMatch(/Sep/);
    expect(formatDate("2026-09-07", "es")).not.toBe("2026-09-07");
    expect(isLocale("es")).toBe(true);
    expect(isLocale("fr")).toBe(false);
  });
});
