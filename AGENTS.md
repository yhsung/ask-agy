# Repository guidance

## Publishing ask-agy to GitHub

### Automated release lifecycle

`package.json.version` is the sole release version source. Stable SemVer version changes merged to `main` trigger the GitHub release workflow; a push with no version change does not create a release. This publishes a GitHub source release for omp installation, not an npm package.

1. Make a stable SemVer version bump in a pull request targeting `main`. The new version must be greater than every published stable release. Do not merge a second version-bump PR while an earlier release is awaiting approval or publishing; resolve the first run before starting another.
2. The PR CI runs `bun test` and `npm pack --dry-run`. Both checks must pass before merge.
3. After merge, read-only preflight compares `package.json.version` at the push's before and candidate commits, rejects prereleases, malformed or non-increasing versions and existing tags/releases, reruns the checks at the candidate commit, and writes a review summary. Preflight does not create tags or releases and does not generate release notes.
4. An authorized reviewer approves the protected `release` Environment only after reviewing the preflight summary. The publish job then verifies immutable releases are enabled, rechecks the candidate and unused tag/release, creates an annotated `v<version>` tag at the exact candidate commit, and publishes a non-draft, non-prerelease GitHub release with generated notes.
5. The workflow verifies the release is published and immutable and that the remote peeled tag points to the candidate commit. Install with `omp install "github:yhsung/ask-agy#v<version>"`.

Do not publish to npm or upload release assets. Do not manually create a release tag to bypass a failed or waiting workflow. Never move, delete, or reuse a pushed release tag.

### Required repository setup

Repository owners must configure these settings separately; Actions does not change them:

- Protect `main`: require pull requests and the CI check; prevent direct pushes.
- Create Environment `release` with required reviewers and self-review prevention where supported.
- Create/install a GitHub App only on `yhsung/ask-agy` with `Administration: read`. Store `RELEASE_APP_ID` and `RELEASE_APP_PRIVATE_KEY` as secrets in the protected `release` Environment, not repository-wide secrets. The workflow requests an App token restricted to this repository and that read permission.
- Keep immutable releases enabled. If the setting is disabled or cannot be read, publication stops before tag creation.
- Ensure the Actions policy allows the pinned actions and required `GITHUB_TOKEN` permissions.

Only the reviewer-gated publish job receives `contents: write`; CI and preflight remain read-only. The App token cannot write repository contents or settings. Do not expose the App private key or token in pull-request jobs or logs.

### Failure handling and optional local check

If preflight fails before tag creation, correct the cause; rerun the same workflow run for a transient failure. If source or version changes are needed, resolve the failed run before preparing another version-bump PR. If a write may have succeeded, inspect the remote tag and release by tag; verify the immutable status and exact peeled commit before deciding whether the run completed. Never blindly retry a write or repair by moving/deleting a tag. If the candidate cannot be safely completed, choose a later version in `package.json`.

The local model-backed smoke check is optional and outside Actions; it can incur provider usage:

```sh
omp --extension . --no-session --no-tools --mode json --print "Reply with the single word ready."
```

Do not invoke the `ask-agy` tool or make a real agy request during this check.

### Official references

- [GitHub Actions workflow syntax](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions)
- [GitHub Actions environments and deployment protection rules](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-deployments/managing-environments-for-deployment)
- [Automatic token authentication](https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication)
- [GitHub immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases)
- [REST API: Check immutable releases setting](https://docs.github.com/en/rest/repos/repos#check-if-immutable-releases-are-enabled-for-a-repository)
- [GitHub CLI `gh release create`](https://cli.github.com/manual/gh_release_create)
