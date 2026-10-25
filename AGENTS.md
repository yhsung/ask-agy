# Repository guidance

## Publishing ask-agy to GitHub

Follow this procedure only when the user explicitly asks to publish an `ask-agy` release. A completed milestone or a release-ready state is not authorization to push or publish. This repository distributes the extension from GitHub tags; do not publish to npm or add an automated GitHub Actions release workflow.

### 1. Confirm release authorization and prerequisites

- Confirm the target repository is `yhsung/ask-agy` and `origin` points to `https://github.com/yhsung/ask-agy.git`.
- Run `gh auth status`. Stop if GitHub CLI is not authenticated for this repository.
- The release commit, including the package version, must be on `main` and already present on `origin/main`; require a clean working tree before creating a tag. If release changes still need a commit or push, get the user's authorization before pushing them.
- In GitHub repository **Settings → Releases**, confirm **Enable release immutability** is enabled. It only protects releases published after it is enabled. If it is disabled or cannot be verified, stop; do not publish a mutable release as a substitute.
- Treat `package.json`'s `version` as the sole release version. Select a SemVer version greater than the latest published version: patch for compatible fixes, minor for backward-compatible features, major for breaking changes. Update `package.json` before running the release checks. The initial version `1.0.0` corresponds to tag `v1.0.0`.

### 2. Validate the release commit

At the clean release commit on `main`, run:

```sh
bun test
npm pack --dry-run
omp --extension . --no-session --no-tools --mode json --print "Reply with the single word ready."
```

The omp smoke command loads the repository package root and sends a short prompt to the configured main model; it may incur provider usage. Do not invoke the `ask-agy` tool or make a real agy request during this check. If any check fails, stop and report the failure.

Derive the tag from the package version and confirm it does not exist locally or remotely:

```sh
VERSION="$(node -p "require('./package.json').version")"
TAG="v$VERSION"
git tag --list "$TAG"
git ls-remote --tags origin "refs/tags/$TAG" "refs/tags/$TAG^{}"
```

A failed remote lookup is not proof that the tag is absent. Stop if the tag exists in either location or the remote cannot be checked. Never move, delete, or reuse a tag name that has been pushed.

### 3. Push the tag and create a draft release

Record the verified release commit SHA. Create an annotated tag at that exact commit, push only that tag, then create a draft release:

```sh
COMMIT="$(git rev-parse HEAD)"
git tag -a "$TAG" -m "$TAG" "$COMMIT"
git push origin "$TAG"
REMOTE_COMMIT="$(git ls-remote --tags origin "refs/tags/$TAG^{}" | cut -f1)"
if [ "$REMOTE_COMMIT" != "$COMMIT" ]; then
  printf 'Remote tag does not resolve to release commit %s\n' "$COMMIT" >&2
  exit 1
fi
gh release create "$TAG" --draft --verify-tag --generate-notes --title "$TAG"
```

`--verify-tag` makes GitHub CLI abort if the tag is not already on GitHub instead of silently creating a tag from the default branch. Do not attach assets; omp installs the repository source at the tag. If a command fails after the tag is pushed, inspect the draft and remote tag before retrying; the tag name remains reserved.

### 4. Review, publish, and verify

Before publishing, inspect `gh release view "$TAG"`. Confirm the draft uses the intended tag and commit, and review its generated notes. Show these details to the user and obtain explicit approval to publish the immutable release. Then run:

```sh
gh release edit "$TAG" --draft=false
```

After publishing:

- Confirm `gh release view "$TAG"` reports a published release.
- Confirm the GitHub release page shows the **Immutable** indicator.
- Compare the remote peeled tag commit from `git ls-remote --tags origin "refs/tags/$TAG" "refs/tags/$TAG^{}"` with the verified release commit SHA.
- Report the exact installation command:

```sh
omp install "github:yhsung/ask-agy#$TAG"
```

### 5. Corrections

An immutable release tag cannot be moved or deleted while its release exists, and its name cannot be reused after deleting the release. Correct a published release by selecting the next appropriate SemVer version in `package.json` and publishing a new tag. Never force-push, move, delete, or reuse an already-published tag.

### Official references

- [omp extension authoring — installing from Git](https://omp.sh/docs/extension-authoring)
- [GitHub immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases)
- [Enable release immutability](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/establish-provenance-and-integrity/prevent-release-changes)
- [GitHub CLI `gh release create`](https://cli.github.com/manual/gh_release_create)
- [GitHub CLI `gh release edit`](https://cli.github.com/manual/gh_release_edit)
