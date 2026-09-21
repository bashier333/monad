import { createReadStream, existsSync, readdirSync, statSync } from "fs";
import path from "path";
import { Readable } from "stream";
import { NextResponse } from "next/server";

// Public download of the desktop app. Prefers the NSIS installer
// (Monad-Ontology-Setup-*.exe, newest by mtime) and falls back to the
// portable zip. Extraction is required before launch for the zip — the exe
// only works with its folder beside it.
function distDir(): string {
  // Explicit override wins (staging pins an exact directory).
  const override = process.env.MONAD_DIST_PATH;
  if (override) return override;
  // NOTE: deliberately NOT path.join(process.cwd(), "dist"). Next's file
  // tracer statically follows path.join/process.cwd() literals and bundles
  // the whole dist/ tree into the server output — nesting every previous
  // packaging run inside the next one until NSIS chokes and the disk fills.
  // Array join is resolved at runtime only.
  return [process.cwd(), "dist"].join(path.sep);
}

function findArtifact(): { filePath: string; filename: string } | null {
  // Explicit override wins (staging pins an exact artifact).
  const pinned = process.env.MONAD_ZIP_PATH;
  if (pinned && existsSync(pinned)) {
    return { filePath: pinned, filename: path.basename(pinned) };
  }
  const dist = distDir();
  if (!existsSync(dist)) return null;
  const setup = readdirSync(dist)
    .filter((f) => /^Monad-Ontology-Setup-.*\.exe$/i.test(f))
    .map((f) => ({ f, mtime: statSync(path.join(dist, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)[0];
  if (setup) {
    return { filePath: path.join(dist, setup.f), filename: setup.f };
  }
  const zip = path.join(dist, "Monad-Ontology-win64.zip");
  if (existsSync(zip)) {
    return { filePath: zip, filename: "Monad-Ontology-win64.zip" };
  }
  return null;
}

export async function GET() {
  const artifact = findArtifact();
  if (!artifact) {
    return NextResponse.json({ error: "desktop build not packaged on this server" }, { status: 404 });
  }
  const size = statSync(artifact.filePath).size;
  const stream = Readable.toWeb(createReadStream(artifact.filePath)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "content-type": artifact.filename.endsWith(".exe") ? "application/octet-stream" : "application/zip",
      "content-disposition": `attachment; filename="${artifact.filename}"`,
      "content-length": String(size),
    },
  });
}
