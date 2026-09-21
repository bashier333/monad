import { createReadStream, existsSync, statSync } from "fs";
import path from "path";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { distDir } from "@/lib/core/updates-dist";

// Serves update artifacts to the desktop updater: Setup installers, their
// .blockmap files (differential updates), and the portable zip fallback.
// Strict allowlist + basename confinement: no traversal, no arbitrary files.
// Public (the exe updater holds no session); reads no organization data.
const ALLOWED = /^Monad-Ontology-(Setup-.*\.exe(\.blockmap)?|win64\.zip)$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const name = decodeURIComponent(file);
  if (name.includes("/") || name.includes("\\") || name.includes("..") || !ALLOWED.test(name)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const full = path.join(distDir(), name);
  if (!existsSync(full)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  let size: number;
  try {
    const st = statSync(full);
    if (!st.isFile()) return NextResponse.json({ error: "not found" }, { status: 404 });
    size = st.size;
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const stream = Readable.toWeb(createReadStream(full)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "content-type": "application/octet-stream",
      "content-disposition": `attachment; filename="${name}"`,
      "content-length": String(size),
    },
  });
}
