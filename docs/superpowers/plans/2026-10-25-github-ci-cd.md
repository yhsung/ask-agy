# Require Pull Requests for `main` — Implementation Plan

**Goal:** Ensure changes reach `main` through a pull request. Feature-branch pushes remain allowed; repeated pushes update the same PR.

**Scope:** Configure one GitHub branch ruleset for `main`. This plan does not change CI or release workflows, and does not require release Environments, GitHub Apps, or immutable-release setup.

## Repository setting

A repository admin configures this outside the codebase:

1. Open `yhsung/ask-agy` → **Settings → Rules → Rulesets** and create a branch ruleset.
2. Set enforcement to **Active** and target the `main` branch.
3. Enable **Require a pull request before merging**.
4. Leave the bypass list empty so the rule also applies to the repository owner.
5. Do not add required approvals or status checks for this goal; they are separate policies.

## Verification

- A direct push to `main` is rejected by GitHub.
- A push to a feature branch succeeds and can be included in a PR targeting `main`.
- This rule requires a PR, but does not require someone other than the author to approve it.

The ruleset is the enforcement mechanism. Committing this Markdown does not configure repository settings.
