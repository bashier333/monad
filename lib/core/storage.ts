import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";

const ROOT = path.join(process.cwd(), "var", "uploads");

function safePath(key: string): string {
  const full = path.normalize(path.join(ROOT, key));
  if (!full.startsWith(ROOT + path.sep) && full !== ROOT) {
    throw new Error("storage key escapes uploads dir");
  }
  return full;
}

export async function saveBytes(key: string, bytes: Buffer): Promise<void> {
  const full = safePath(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
}

export async function readBytes(key: string): Promise<Buffer> {
  return readFile(safePath(key));
}

export async function deleteBytes(key: string): Promise<void> {
  await rm(safePath(key), { force: true });
}
