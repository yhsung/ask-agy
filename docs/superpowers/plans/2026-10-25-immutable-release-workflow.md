# Immutable GitHub Release Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a root `AGENTS.md` procedure for explicitly authorized, immutable GitHub releases of `ask-agy`.

**Architecture:** Keep release orchestration manual and user-authorized through GitHub CLI; do not add GitHub Actions or npm publication. `package.json` remains the version source, Git tags use `v<version>`, and GitHub repository release immutability protects published tags.

**Tech Stack:** Git, GitHub CLI (`gh`), GitHub Releases, Bun, omp.

**Spec:** `docs/superpowers/specs/2026-10-25-immutable-release-workflow-design.md`

## Global Constraints

- Publish only when the user explicitly requests a release.
- Require GitHub release immutability to be enabled before publishing a release.
- Never move, delete, or reuse a published or remotely pushed release tag.
- Do not add GitHub Actions, publish to npm, or create a release as part of documenting this workflow.

---

### Task 1: Add the manual immutable release procedure

**Files:**
- Create: `AGENTS.md`

**Interfaces:**
- Consumes: package version and repository coordinates from `package.json`; GitHub CLI release commands; the root package extension entrypoint.
- Produces: an instruction section an agent can follow when the user explicitly requests an `ask-agy` release.

- [x] **Step 1: Document release authorization and prerequisites**

State that an agent may publish only after an explicit user release request. Require `gh auth status`, a clean working tree on `main`, and the exact release commit to already exist on `origin/main`. If code must first be pushed to `main`, ask before pushing. Require the repository's **Settings → Releases → Enable release immutability** setting; if it is disabled or cannot be verified, stop. Explain that this setting applies only to future releases.

- [x] **Step 2: Define version and pre-release checks**

Follow SemVer and ensure the new version is greater than the latest published release: patch for compatible fixes, minor for backward-compatible features, major for breaking changes. Update `package.json` to the selected release version and include that change in the validated commit on `main`. Use only `package.json`'s `version` field and derive the tag as `v<version>`; for the current `1.0.0`, the first tag is `v1.0.0`. Require the tag to be absent both locally (`git tag --list "$TAG"`) and remotely (`git ls-remote --tags origin "refs/tags/$TAG" "refs/tags/$TAG^{}"`). Stop if either check finds a tag or remote lookup fails. After the version commit is present on `origin/main`, run `bun test`, `npm pack --dry-run`, and a fresh omp extension-load smoke command:

```sh
omp --extension . --no-session --no-tools --mode json --print "Reply with the single word ready."
```

The smoke command exercises the package-root loader and the configured main model; it must not invoke `ask-agy` or the real agy upstream.

- [x] **Step 3: Document tag and draft-release creation**

At the verified release commit, create and push an annotated tag, compare its remote peeled commit SHA to the tested release commit SHA, then create a draft release:

```sh
TAG="v$(node -p "require('./package.json').version")"
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

Explain that `--verify-tag` prevents GitHub CLI from silently creating a tag from the default branch. Do not upload release assets; omp installs the repository source at the tag.

- [x] **Step 4: Document human review, publication, and verification**

Before publishing, inspect `gh release view "$TAG"`, verify the draft uses the intended tag and commit, and review generated notes. Publish only after explicit user authorization using:

```sh
gh release edit "$TAG" --draft=false
```

Then verify `gh release view "$TAG"` shows a published release, check GitHub displays the **Immutable** indicator, and confirm the remote tag's peeled commit SHA equals the tested release commit. Report the exact consumer command:

```sh
omp install "github:yhsung/ask-agy#$TAG"
```

- [x] **Step 5: Document abort and correction rules**

On a failed prerequisite, do not push or publish; report the blocker. Once a release tag has been pushed, treat the name as permanently reserved even if a draft fails. After publication, correct defects by increasing `package.json`'s SemVer version and releasing a new tag; never retag, delete, or reuse the old tag. Link the GitHub immutable-release and GitHub CLI documentation.

### Task 2: Verify the workflow without publishing

**Files:**
- Verify: `AGENTS.md`
- Do not modify: `package.json`, release tags, GitHub releases, or GitHub settings.

**Interfaces:**
- Consumes: the approved release workflow in Task 1.
- Produces: evidence that all guardrails and commands are documented without creating an actual tag or release.

- [x] **Step 1: Check every design requirement against the document**

Read `AGENTS.md` and verify it contains explicit user authorization, clean-main and remote-commit prerequisites, immutability setting, version/tag equality, local and remote tag-existence checks, all three pre-release checks, draft creation, human review, explicit publication, immutable badge and commit verification, the exact omp install command, and the no-retag/no-npm/no-Actions rules.

- [x] **Step 2: Validate documented CLI syntax safely**

Run `gh release create --help` and `gh release edit --help`; confirm the documented flags `--draft`, `--verify-tag`, `--generate-notes`, `--title`, and `--draft=false` are supported. Do not run either command with a release tag. Confirm the GitHub links in `AGENTS.md` point to official documentation.

- [x] **Step 3: Confirm no release side effects occurred**

Do not create or push a tag, create a release, change repository settings, or install the extension. Report the `AGENTS.md` path and the commands used to verify it.
