import { describe, expect, it } from "vitest";
import { validateBulkRow, validateBulkRows } from "@/lib/core/corrections-bulk";

describe("bulk corrections CSV import (R-485)", () => {
  it("validates rows", () => {
    expect(validateBulkRow({ targetKey: "L1", field: "detention" })).toBeNull();
    expect(validateBulkRow({ field: "detention" })).toBe("every row needs targetKey and field");
    expect(validateBulkRow({ targetKey: "L1" })).toBe("every row needs targetKey and field");
    expect(validateBulkRow({ targetKey: "L1", field: "f", reason: "x".repeat(5001) })).toBe("reason too long (max 5000)");
  });

  it("validates batches (≤100)", () => {
    expect(validateBulkRows([]).ok).toBe(false);
    expect(validateBulkRows(Array.from({ length: 101 }, () => ({ targetKey: "L1", field: "f" }))).ok).toBe(false);
    expect(validateBulkRows([{ targetKey: "L1", field: "f" }])).toEqual({
      ok: true,
      rows: [{ targetKey: "L1", field: "f" }],
    });
  });
});
