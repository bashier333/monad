import { describe, expect, it } from "vitest";
import { deleteBytes, readBytes, saveBytes } from "@/lib/core/storage";

describe("storage safety (S-231/S-232/S-523)", () => {
  it("round-trips bytes and deletes them", async () => {
    const key = `test-org/roundtrip-${Date.now()}.csv`;
    await saveBytes(key, Buffer.from("a,b\n1,2"));
    expect((await readBytes(key)).toString("utf8")).toContain("a,b");
    await deleteBytes(key);
    await expect(readBytes(key)).rejects.toThrow();
  });

  it("keys cannot escape the uploads dir (S-231)", async () => {
    await expect(saveBytes("../escape.csv", Buffer.from("x"))).rejects.toThrow(/escapes/);
    await expect(saveBytes("a/../../escape.csv", Buffer.from("x"))).rejects.toThrow(/escapes/);
    await expect(readBytes("..\\escape.csv")).rejects.toThrow(/escapes/);
    const contained = `test-org/abs-${Date.now()}.csv`;
    await saveBytes(contained, Buffer.from("x"));
    expect((await readBytes(contained)).toString("utf8")).toBe("x");
    await deleteBytes(contained);
  });
});
