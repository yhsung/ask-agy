# GitHub-installable ask-agy Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `yhsung/ask-agy` directly installable from GitHub as an omp extension without changing its behavior.

**Architecture:** Keep the existing runtime factory at `.omp/extensions/ask-agy.ts` and runtime logic in `src/advisor.ts`. Configure the repository root as the extension package using `omp.extensions`, include the runtime files in the package manifest, and document immutable-tag GitHub installation.

**Tech Stack:** omp, TypeScript, Bun, npm package tarball tooling.

**Spec:** `docs/superpowers/specs/2026-10-25-github-installable-extension-design.md`

## Global Constraints

- Do not change `/ask-agy`, tool parameter names, model selection, prompt behavior, process limits, or logging behavior.
- The extension remains unsandboxed and relies on a local authenticated `agy` CLI.
- Do not add a marketplace catalog, npm publication, new capability, or automatic release workflow.
- GitHub installs must use an immutable release tag for reproducibility.

---

### Task 1: Configure the repository as an omp extension package

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: package metadata consumed by omp's plugin installer and loader. `omp.extensions` contains `./.omp/extensions/ask-agy.ts`; package `files` includes that factory, `src/advisor.ts`, and `README.md`.

- [ ] **Step 1: Update package metadata**

Remove `private: true`; add package `description`, repository URL `https://github.com/yhsung/ask-agy`, license metadata only if a matching license file exists, and `files` containing `.omp/extensions/ask-agy.ts`, `src/advisor.ts`, and `README.md`. Add `omp.extensions: ["./.omp/extensions/ask-agy.ts"]`. Preserve module type, Bun test script, and Bun engine constraint. Do not add runtime dependencies unless the source imports a package not provided by Node, Bun, or omp.

- [ ] **Step 2: Run the existing test suite**

Run: `bun test`
Expected: all existing tests pass unchanged; package metadata must not alter extension behavior.

- [ ] **Step 3: Inspect the generated package contents**

Run: `npm pack --dry-run`
Expected: output includes `package.json`, `README.md`, `.omp/extensions/ask-agy.ts`, and `src/advisor.ts`; tests and unrelated development files are not required in the package.

- [ ] **Step 4: Smoke-load the package root with omp**

Run the installed omp CLI's supported extension-loading path against the repository root in a fresh non-interactive session, for example `omp --extension .` from the repository. Do not invoke the advisor tool or make a real agy upstream request.
Expected: omp discovers/loads `.omp/extensions/ask-agy.ts` without import or factory errors. If the installed CLI cannot expose a non-interactive load result, use the TUI `/extensions` discovery view and record the limitation rather than claiming the load succeeded.

### Task 2: Document GitHub installation and operating requirements

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: package coordinates `yhsung/ask-agy` and extension entry path from Task 1.
- Produces: end-user installation, setup, restart, and safety instructions consistent with omp docs.

- [ ] **Step 1: Replace project-local-only setup with GitHub installation**

Document `omp install github:yhsung/ask-agy#vX.Y.Z` as the reproducible install form, state that the tag must be an immutable release tag, and explain that users must restart omp after installing/upgrading runtime extension code. Keep local development instructions, but remove machine-specific absolute paths and claims that the plugin loads only through project discovery.

- [ ] **Step 2: Preserve and clarify prerequisites and safety boundaries**

Retain the requirement for `omp`, Bun (for development/tests), and authenticated `agy` on PATH with the supported model available. Explain that extension code runs with omp's filesystem/network/process privileges and that question/context content is sent to agy's upstream service. Preserve the existing command/tool contracts, model list, limitations, and test instructions without duplicating the new installation guidance.

- [ ] **Step 3: Verify documentation against actual package metadata**

Check that the documented owner/repository, extension entry, install syntax, and restart guidance match `package.json` and omp extension-authoring docs. Run `bun test` and `npm pack --dry-run` once more after documentation changes.
Expected: no stale absolute paths, no contradictory installation instructions, all tests pass, and the tarball still contains every runtime file.
