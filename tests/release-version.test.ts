import {
  compareStableSemVer,
  getReleaseCandidate,
  highestStableTagVersion,
  parseStableSemVer,
} from "../scripts/release-version";

describe("stable release versions", () => {
  test("parses stable versions and compares numeric components", () => {
    expect(parseStableSemVer("1.10.0")).toEqual({ major: 1n, minor: 10n, patch: 0n });
    expect(parseStableSemVer("1.2.3+build.7")).toEqual({ major: 1n, minor: 2n, patch: 3n });
    expect(compareStableSemVer("1.2.3+build.7", "1.2.3")).toBe(0);
    expect(compareStableSemVer("1.10.0", "1.9.0")).toBe(1);
    expect(compareStableSemVer("9007199254740993.0.0", "9007199254740992.0.0")).toBe(1);
  });

  test("rejects prereleases, malformed numeric identifiers, and surrounding whitespace", () => {
    expect(parseStableSemVer("1.2.3-rc.1")).toBeNull();
    expect(parseStableSemVer("01.2.3")).toBeNull();
    expect(parseStableSemVer("1.2")).toBeNull();
    expect(parseStableSemVer("1.2.3\n")).toBeNull();
    expect(parseStableSemVer(" 1.2.3")).toBeNull();
  });


  test("finds the highest stable version and ignores prerelease or malformed tags", () => {
    expect(highestStableTagVersion(["v1.0.0", "v2.0.0-rc.1", "release", "v1.9.0"])).toBe("1.9.0");
  });

  test("skips unchanged versions and rejects versions not newer than a published release", () => {
    expect(getReleaseCandidate("1.0.0", "1.0.0", ["v1.0.0"])).toBeNull();
    expect(() => getReleaseCandidate("0.9.0", "1.0.0", ["v1.0.0"])).toThrow();
    expect(() => getReleaseCandidate("1.0.0", "0.9.9", ["v1.0.0"])).toThrow();
    expect(() => getReleaseCandidate("1.0.0", "1.1.0-rc.1", ["v1.0.0"])).toThrow();
    expect(getReleaseCandidate("1.0.0", "1.1.0", ["v1.0.0"])).toEqual({
      tag: "v1.1.0",
      latestPublishedVersion: "1.0.0",
    });
  });
});
