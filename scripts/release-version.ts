import { readFileSync } from "node:fs";

export type StableSemVer = Readonly<{
  major: bigint;
  minor: bigint;
  patch: bigint;
}>;

export type ReleaseCandidate = Readonly<{
  tag: string;
  latestPublishedVersion: string | null;
}>;

const stablePattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function parseStableSemVer(value: string): StableSemVer | null {
  const match = stablePattern.exec(value);
  if (match === null || match[0] !== value) return null;
  return {
    major: BigInt(match[1]!),
    minor: BigInt(match[2]!),
    patch: BigInt(match[3]!),
  };
}

export function compareStableSemVer(left: string, right: string): -1 | 0 | 1 {
  const a = parseStableSemVer(left);
  const b = parseStableSemVer(right);
  if (a === null || b === null) throw new Error("Cannot compare an invalid stable SemVer version");

  for (const component of ["major", "minor", "patch"] as const) {
    if (a[component] < b[component]) return -1;
    if (a[component] > b[component]) return 1;
  }
  return 0;
}

export function highestStableTagVersion(tags: readonly string[]): string | null {
  let highest: string | null = null;
  for (const tag of tags) {
    if (!tag.startsWith("v")) continue;
    const version = tag.slice(1);
    if (parseStableSemVer(version) === null) continue;
    if (highest === null || compareStableSemVer(version, highest) > 0) highest = version;
  }
  return highest;
}

export function getReleaseCandidate(
  previousVersion: string,
  candidateVersion: string,
  publishedTags: readonly string[],
): ReleaseCandidate | null {
  if (previousVersion === candidateVersion) return null;
  if (parseStableSemVer(candidateVersion) === null) {
    throw new Error("Candidate version must be stable SemVer");
  }
  const latestPublishedVersion = highestStableTagVersion(publishedTags);
  if (
    latestPublishedVersion !== null &&
    compareStableSemVer(candidateVersion, latestPublishedVersion) <= 0
  ) {
    throw new Error("Candidate version must be newer than every published stable release");
  }
  return { tag: `v${candidateVersion}`, latestPublishedVersion };
}

if (import.meta.main) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 3) {
      throw new Error(
        "Usage: bun scripts/release-version.ts <previous-version> <candidate-version> <published-tags-file>",
      );
    }
    const [previousVersion, candidateVersion, tagsFile] = args as [string, string, string];
    const tags = readFileSync(tagsFile, "utf8").split(/\r?\n/).filter(Boolean);
    const candidate = getReleaseCandidate(previousVersion, candidateVersion, tags);
    if (candidate === null) {
      console.log("release=false");
    } else {
      console.log("release=true");
      console.log(`tag=${candidate.tag}`);
      console.log(`latestPublishedVersion=${candidate.latestPublishedVersion ?? ""}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
