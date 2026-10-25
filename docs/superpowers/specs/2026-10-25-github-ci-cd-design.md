# GitHub Actions CI/CD for ask-agy

## Status

Design approved by the repository owner. Implementation has not started.

## Goal

Automate deterministic validation for pull requests and main-branch changes, then publish a GitHub release when a stable package version change is merged to `main` and an authorized reviewer approves the protected release environment.

The release remains a GitHub source-tag release for omp installation. It is not an npm publication.

## Current state

- `package.json` is the sole version source and currently contains `1.0.0`.
- The package requires Bun `>=1.3.0` and defines `bun test` as its test script.
- `npm pack --dry-run` validates the package file set without publishing it.
- The extension is installed from GitHub tags; no server or deployment artifact is involved.
- The repository currently has no GitHub Actions workflows.
- Root `AGENTS.md` documents manual publication and explicitly prohibits automated GitHub release workflows. Implementation must replace that conflicting policy rather than append a second, contradictory procedure.
- GitHub immutable releases are enabled. Published release tags must remain immutable and must never be moved, deleted, or reused.

## Goals and non-goals

### Goals

- Run deterministic checks on pull requests to `main` and pushes to `main`.
- Trigger release preparation only when the `package.json` version changes on `main`.
- Require stable SemVer versions and monotonically increasing published versions.
- Require a protected-environment reviewer approval before creating a release tag or publishing.
- Publish an immutable GitHub release from the exact commit that changed the version.
- Keep write permissions confined to the post-approval publish job.

### Non-goals

- Publishing to npm or another package registry.
- Uploading release assets; omp installs the repository source at the tag.
- Running model-backed OMP smoke tests in Actions. The existing smoke test calls an external model and may incur usage charges; it remains a local release check.
- Supporting prerelease versions such as `-alpha`, `-beta`, or `-rc` in the initial workflow.
- Having Actions configure repository branch protection, environment reviewers, or immutable-release settings. These are repository-level settings configured separately.

## Workflow architecture

### 1. Pull request and main CI

Add `.github/workflows/ci.yml`.

Triggers:

- `pull_request` targeting `main`.
- `push` to `main`.

Jobs:

1. Check out the source.
2. Set up a supported Bun version satisfying `>=1.3.0` and a supported Node/npm runtime for package inspection.
3. Run `bun test`.
4. Run `npm pack --dry-run`.

Security properties:

- Grant only `contents: read` (and any strictly necessary read permission).
- Do not expose repository secrets to pull-request jobs.
- Do not invoke the OMP model smoke command.
- Pin third-party Actions to full commit SHAs when implementing the workflow.

The repository's `main` branch rules must require pull requests and the CI status checks. Direct pushes to `main` should be disabled so a version merge is an intentional release request.

### 2. Version-change detection and release preflight

Add `.github/workflows/release.yml`, triggered by pushes to `main`.

A read-only detection job compares `package.json.version` at the push's `before` commit with the version at the triggering commit. If unchanged, the workflow exits without preparing a release. The triggering commit SHA is the release candidate and remains fixed through approval and publication.

When the version changes, preflight must:

1. Validate that the version is stable SemVer and derive the tag as `v<version>`.
2. Confirm the version is greater than the highest previously published stable SemVer version.
3. Confirm the tag does not already exist locally or remotely and that no release already uses it.
4. Leave the admin-only immutable-release setting check to the protected reviewer-gated job; the preflight `GITHUB_TOKEN` cannot query it.
5. Run `bun test` and `npm pack --dry-run` against the exact candidate commit.
6. Produce a read-only candidate summary containing the version, commit SHA, prior version, commit messages/changed paths, PR references when present in commit messages, and check results. Expose it in the workflow run summary or as an artifact for the reviewer.

Preflight must not create a tag, draft release, or other repository write.

The GitHub release-notes generation endpoint is treated as write-capable; GitHub's fine-grained-token documentation lists `Contents: write` for this endpoint. Do not call it before approval. Preflight provides only the read-only candidate summary. The publish job generates official release notes after approval.

### 3. Protected publication gate

The single `publish` job uses the protected GitHub Environment named `release`, with required reviewers and self-review prevention where supported. The reviewer sees the preflight summary before approving the job. The job cannot start until approval; the App private key stored in this Environment is unavailable beforehand.

After approval, `publish` must perform these steps in order:

1. Obtain a short-lived GitHub App installation token restricted to this repository and `Administration: read`. Use it to query the immutable-release setting immediately before publication. If the setting is disabled or cannot be read, fail before any tag/release write.
2. Revalidate that the candidate tag/release is absent and the candidate version remains greater than the latest published stable version.
3. Create an annotated tag `v<version>` at the exact triggering commit SHA and push only that tag.
4. Create a non-draft, non-prerelease GitHub release for that verified tag, using GitHub-generated release notes. Do not upload assets or publish to npm.
5. Verify the release is published and immutable, and verify the remote peeled tag SHA equals the candidate commit SHA. Any mismatch is a hard failure; do not try to repair it by moving or deleting the tag.

Only this post-approval job receives `contents: write` through `GITHUB_TOKEN` and the App private key for its read-only setting query. The GitHub App token cannot modify repository contents or settings. Do not add write-capable steps before the setting check. Keep workflow defaults and all other jobs read-only, serialize release jobs, and do not cancel a publication already in progress. Repository admins must not disable immutable releases while publication is in progress.

## Release state and failure handling

Expected state transitions:

```text
Version unchanged ──> CI only
Version changed ──> preflight checks ──> reviewer approval ──> immutable-setting check ──> tag + published immutable release
                                  └── tests fail / reviewer rejects / setting unavailable ──> no tag, no release
```

- A failed test, invalid/non-increasing version, existing tag, disabled immutability, or rejected environment approval must not create a tag.
- If publication fails after a tag has been pushed, fail closed. Inspect the remote tag and release state; never move, delete, or reuse the tag. Manual recovery must verify the exact commit and published state before any further action. If the candidate cannot be safely completed, use a new version for a later release.
- If the API call's result is ambiguous, query GitHub by tag and verify both release immutability and the peeled tag commit before deciding whether the run completed. Do not blindly retry a write.
- If multiple version-change runs overlap, serialize them. Do not merge another release version while an earlier candidate is waiting for approval or publishing; resolve the first candidate before starting the next.

## Repository settings required before enabling the workflow

1. Protect `main`: require pull requests and the CI status checks; prevent direct pushes.
2. Create the `release` Environment and configure required reviewers; prevent self-review where supported.
3. Create a GitHub App with `Administration: read`, install it only on `yhsung/ask-agy`, and store its ID/private key as secrets in the protected `release` Environment.
4. Keep GitHub repository immutable releases enabled.
5. Verify the repository's Actions policy permits the selected pinned Actions and the required `GITHUB_TOKEN` permissions.

These settings are not represented by workflow YAML and must be verified in repository settings as a separate implementation prerequisite.

## Documentation migration

When implementing the workflows, update root `AGENTS.md`:

- Remove the blanket prohibition on automated GitHub release workflows.
- Replace the manual tag/draft/publish procedure with the version-bump PR, CI, Environment approval, and automated publication lifecycle.
- Preserve the rules against npm publication, mutable releases, and moving/deleting/reusing published version tags.
- Document how to diagnose a failed release run without force-pushing or reusing a tag.

## Acceptance criteria for implementation

1. A pull request to `main` runs `bun test` and `npm pack --dry-run`; a failure prevents the required CI status from passing.
2. A `main` push without a version change does not create a tag or release.
3. A stable version bump runs preflight against the exact pushed commit; invalid, non-increasing, already-used, or otherwise unsafe versions fail before tag creation.
4. Tests or packaging failures leave no release tag.
5. The protected publish job cannot start until an authorized reviewer approves; if the immutable-release setting is disabled or unreadable, it stops before any tag/release write.
6. The publish job receives only `contents: write` and publishes one GitHub release with tag `v<package.json.version>`, with the tag resolving to the exact candidate commit.
7. The published release reports immutable status; the workflow fails before tag creation if immutability cannot be verified, and fails after publication if immutable status or the tag SHA is wrong.
8. The GitHub App token is limited to `Administration: read` for this repository; CI and preflight remain read-only; no PAT or model key is used.
9. No workflow calls an external model, publishes to npm, or uploads release assets.
10. Documentation describes the automated process and the recovery constraints.

## Official references

- [GitHub Actions workflow syntax](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions)
- [GitHub Actions environments and deployment protection rules](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-deployments/managing-environments-for-deployment)
- [Automatic token authentication](https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication)
- [Immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases)
- [REST API: Generate release notes](https://docs.github.com/en/rest/releases/releases#generate-release-notes-content-for-a-release)
- [REST API: Create a release](https://docs.github.com/en/rest/releases/releases#create-a-release)
- [Bun setup Action](https://github.com/oven-sh/setup-bun)
- [REST API: Check immutable releases setting](https://docs.github.com/en/rest/repos/repos#check-if-immutable-releases-are-enabled-for-a-repository)
