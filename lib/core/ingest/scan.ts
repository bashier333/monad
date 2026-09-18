export interface ScanResult {
  ok: boolean;
  mime: string;
  reason?: string;
}

export const MAX_BYTES = 50 * 1024 * 1024;

const EICAR =
  "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

export function scanBuffer(filename: string, bytes: Buffer): ScanResult {
  const lower = filename.toLowerCase();
  const isCsv = lower.endsWith(".csv");
  const isXlsx = lower.endsWith(".xlsx");
  if (!isCsv && !isXlsx) {
    return { ok: false, mime: "unknown", reason: "unsupported extension (allowed: .csv, .xlsx)" };
  }
  if (bytes.length === 0) return { ok: false, mime: "unknown", reason: "empty file" };
  if (bytes.length > MAX_BYTES) return { ok: false, mime: "unknown", reason: "file exceeds 50MB" };

  if (isXlsx) {
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
    if (!isZip) return { ok: false, mime: "unknown", reason: ".xlsx is not a valid zip container" };
  } else {
    if (bytes.includes(0)) {
      return { ok: false, mime: "unknown", reason: ".csv contains binary data" };
    }
  }

  if (bytes.toString("utf8").includes(EICAR)) {
    return { ok: false, mime: "unknown", reason: "malware test signature detected" };
  }

  return { ok: true, mime: isXlsx ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv" };
}
