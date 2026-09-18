import { scanBuffer } from "@/lib/core/ingest/scan";
import { describe, expect, it } from "vitest";

describe("scanBuffer (upload contract)", () => {
  it("accepts csv and xlsx", () => {
    expect(scanBuffer("tms.csv", Buffer.from("a,b\n1,2")).ok).toBe(true);
    const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]);
    expect(scanBuffer("sheet.xlsx", zip).ok).toBe(true);
  });

  it("rejects bad extensions, empty files, and binary csv", () => {
    expect(scanBuffer("evil.exe", Buffer.from("x")).ok).toBe(false);
    expect(scanBuffer("empty.csv", Buffer.alloc(0)).ok).toBe(false);
    expect(scanBuffer("bin.csv", Buffer.from([0x61, 0x00, 0x62])).ok).toBe(false);
    expect(scanBuffer("fake.xlsx", Buffer.from("not a zip")).ok).toBe(false);
  });

  it("rejects the EICAR test signature", () => {
    const eicar = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
    const r = scanBuffer("tms.csv", Buffer.from(`LoadID\n${eicar}`));
    expect(r.ok).toBe(false);
  });

  it("rejects files over 50MB before parsing", () => {
    const big = Buffer.alloc(51 * 1024 * 1024, 0x61);
    const r = scanBuffer("big.csv", big);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("50MB");
  });
});
