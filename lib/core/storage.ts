import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const ROOT = path.join(process.cwd(), "var", "uploads");

export async function saveBytes(key: string, bytes: Buffer): Promise<void> {
  await mkdir(ROOT, { recursive: true });
  await writeFile(path.join(ROOT, key), bytes);
}

export async function readBytes(key: string): Promise<Buffer> {
  return readFile(path.join(ROOT, key));
}
