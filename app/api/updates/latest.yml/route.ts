import { NextResponse } from "next/server";
import path from "path";
import { distDir, listSetupArtifacts, sha512File } from "@/lib/core/updates-dist";
import { buildLatestYml, pickNewest } from "@/lib/core/updates";

// Public update feed for the desktop exe (electron-updater generic
// provider reads latest.yml from the feed URL). Version and files derive
// from the Setup installers actually present in dist/ — never from the
// running code's package.json, which may be ahead of what is published.
// No organization data. Reads no secrets.
export const dynamic = "force-dynamic";

// path+mtime+size → sha512, so repeated checks don't rehash 300MB.
const hashCache = new Map<string, { mtimeMs: number; size: number; sha512: string }>();

export async function GET() {
  const newest = pickNewest(
    listSetupArtifacts().map((a) => ({ ...a, sha512Base64: "" }))
  );
  if (!newest) {
    return NextResponse.json({ error: "no published installer in dist/" }, { status: 404 });
  }
  const cached = hashCache.get(newest.filename);
  let sha512 = cached && cached.mtimeMs === newest.mtimeMs && cached.size === newest.size ? cached.sha512 : null;
  if (!sha512) {
    try {
      sha512 = await sha512File(path.join(distDir(), newest.filename));
    } catch {
      return NextResponse.json({ error: "installer unreadable" }, { status: 500 });
    }
    hashCache.set(newest.filename, { mtimeMs: newest.mtimeMs, size: newest.size, sha512 });
  }
  const yml = buildLatestYml({
    version: newest.version,
    filename: newest.filename,
    size: newest.size,
    sha512Base64: sha512,
    releaseDate: new Date(newest.mtimeMs).toISOString(),
  });
  return new Response(yml, {
    headers: { "content-type": "text/yaml; charset=utf-8", "cache-control": "no-store" },
  });
}
