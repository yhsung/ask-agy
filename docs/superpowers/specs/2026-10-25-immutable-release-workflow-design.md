# Immutable GitHub release workflow for ask-agy

## Goal

Document a repeatable, explicitly authorized GitHub release process for `ask-agy`, so each published omp installation reference resolves to a permanent version tag.

## Current state

- `package.json` is version `1.0.0`; it defines the GitHub repository and omp extension entrypoint.
- `README.md` documents installation as `omp install github:yhsung/ask-agy#<release-tag>` and gives `v1.0.0` as an example after publication.
- No root `AGENTS.md` exists, and no GitHub release has been published.
- The approved extension packaging design excludes npm publication and automated release workflows.

## Design

Create a root `AGENTS.md` section for an explicitly requested release of the extension. Use GitHub CLI for the manual release lifecycle, with `package.json` as the only version source and `v<package.json.version>` as the tag. Require a clean working tree, a release commit on `main`, and passing `bun test`, `npm pack --dry-run`, and omp extension-load smoke checks before creating a tag.

Require GitHub repository release immutability to be enabled before publishing. Create an annotated local tag at the verified release commit, confirm that the tag name is absent locally and remotely, then push the tag. Create a GitHub draft release with `gh release create <tag> --draft --verify-tag --generate-notes --title <tag>`. Review the draft's tag, target commit, and generated notes before publishing it with `gh release edit <tag> --draft=false`.

After publication, verify that the release is no longer a draft, GitHub marks it immutable, the remote tag resolves to the intended commit, and the README's exact `omp install github:yhsung/ask-agy#<tag>` reference is usable. Do not move, delete, or reuse a published tag. If a correction is required after publication, increment the package version and publish a new tag. Do not publish to npm or add GitHub Actions.

## Authorization and failure handling

The agent must not push a release tag or publish a release unless the user explicitly requests that release. Missing immutable-release enforcement, an existing tag, a dirty working tree, mismatched versions, or a failed check blocks publication. Stop and report the exact failed prerequisite; never work around immutability or substitute a mutable tag.

## Official references

- [GitHub immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases)
- [Enabling release immutability](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/establish-provenance-and-integrity/prevent-release-changes)
- [Managing releases in a repository](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)
- [GitHub CLI `gh release create`](https://cli.github.com/manual/gh_release_create)
- [GitHub CLI `gh release edit`](https://cli.github.com/manual/gh_release_edit)
