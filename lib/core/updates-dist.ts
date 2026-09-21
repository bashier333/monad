import { createHash } from "node:crypto";
import { createReadStream, existsSync, readdirSync, statSync } from "fs";
import path from "path";
import { parseSetupVersion } from "@/lib/core/updates";

// SERVER-ONLY: node:fs/path hashing for the update feed. Never import this
// from client components — the build will fail loudly if you do (node
// builtins don't bundle for the browser), which is the intended tripwire.
export interface DistSetupArtifact {
  filename: string;
  version: string;
  size: number;
  mtimeMs: number;
}

export function distDir(): string {
  const override = process.env.MONAD_DIST_PATH;
  if (override) return override;
  // Same tracer-avoidance as the download route: array join resolves at
  // runtime only, so Next never bundles dist/ into the server output.
  return [process.cwd(), "dist"].join(path.sep);
}

/** Setup installers present in dist/, newest version first. */
export function listSetupArtifacts(): DistSetupArtifact[] {
  const dist = distDir();
  if (!existsSync(dist)) return [];
  const out: DistSetupArtifact[] = [];
  for (const f of readdirSync(dist)) {
    const version = parseSetupVersion(f);
    if (!version) continue;
    try {
      const st = statSync(path.join(dist, f));
      if (!st.isFile()) continue;
      out.push({ filename: f, version, size: st.size, mtimeMs: st.mtimeMs });
    } catch {
      continue;
    }
  }
  return out;
}

/** sha512/base64 of a file, streamed so 300MB installers don't sit in RAM. */
export function sha512File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha512");
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk as Buffer));
    stream.on("end", () => resolve(hash.digest("base64")));
  });
}
