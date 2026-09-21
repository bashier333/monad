// Pure update-feed model: parse semver from installer filenames, compare
// versions, and render the electron-updater generic-provider latest.yml.
// No fs/crypto here so this module stays import-safe anywhere; routes do
// I/O and hashing. Tested in updates.test.ts.
export interface UpdateArtifact {
  filename: string;
  version: string;
  size: number;
  /** sha512 digest, base64-encoded (electron-updater generic format). */
  sha512Base64: string;
  /** filesystem mtime, for cache invalidation (route supplies it). */
  mtimeMs: number;
}

const SETUP_RE = /^Monad-Ontology-Setup-(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\.exe$/i;

/** "Monad-Ontology-Setup-1.2.0.exe" -> "1.2.0", anything else -> null. */
export function parseSetupVersion(filename: string): string | null {
  const m = SETUP_RE.exec(filename.trim());
  return m ? m[1]! : null;
}

function coreParts(v: string): { nums: number[]; pre: string | null } {
  const [core, ...rest] = v.split("-");
  return {
    nums: (core ?? "").split(".").map((p) => {
      const n = Number(p);
      return Number.isInteger(n) && n >= 0 ? n : NaN;
    }),
    pre: rest.length > 0 ? rest.join("-") : null,
  };
}

function isValidVersion(v: string): boolean {
  const { nums } = coreParts(v);
  return nums.length === 3 && nums.every((n) => !Number.isNaN(n));
}

/**
 * Compare dot-separated versions. Returns negative if a < b, 0 if equal,
 * positive if a > b. Release beats prerelease on the same core
 * (1.2.0 > 1.2.0-beta). Returns 0 for anything unparseable (never crash
 * update checks on a weird filename).
 */
export function compareVersions(a: string, b: string): number {
  if (!isValidVersion(a) || !isValidVersion(b)) return 0;
  const pa = coreParts(a);
  const pb = coreParts(b);
  for (let i = 0; i < 3; i++) {
    if (pa.nums[i] !== pb.nums[i]) return (pa.nums[i] as number) - (pb.nums[i] as number);
  }
  if (pa.pre === pb.pre) return 0;
  if (pa.pre === null) return 1;
  if (pb.pre === null) return -1;
  return pa.pre < pb.pre ? -1 : 1;
}

/** Newest by version (never by mtime — clocks lie, versions don't). */
export function pickNewest(artifacts: UpdateArtifact[]): UpdateArtifact | null {
  let best: UpdateArtifact | null = null;
  for (const a of artifacts) {
    if (!isValidVersion(a.version)) continue;
    if (!best || compareVersions(a.version, best.version) > 0) best = a;
  }
  return best;
}

export interface LatestYmlInput {
  version: string;
  filename: string;
  size: number;
  sha512Base64: string;
  releaseDate: string;
}

/** Exact electron-updater generic-provider document. First line is always
 *  `version: X` so lightweight clients can regex it without a YAML parser. */
export function buildLatestYml(input: LatestYmlInput): string {
  return [
    `version: ${input.version}`,
    "files:",
    `  - url: ${input.filename}`,
    `    sha512: ${input.sha512Base64}`,
    `    size: ${input.size}`,
    `path: ${input.filename}`,
    `sha512: ${input.sha512Base64}`,
    `releaseDate: '${input.releaseDate}'`,
    "",
  ].join("\n");
}
