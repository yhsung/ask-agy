# GitHub-installable ask-agy extension

## Goal

Package the existing ask-agy implementation as an omp extension that users can install directly from this GitHub repository, without introducing a marketplace.

## Current state

- `.omp/extensions/ask-agy.ts` is the extension factory and registers `/ask-agy` plus the `ask-agy` tool.
- The factory imports `src/advisor.ts` for model selection and agy CLI execution.
- `package.json` is private and has no `omp.extensions` entry or published package file list.
- `README.md` describes local project loading and an absolute-path development invocation.
- Existing behavior has Bun tests in `tests/advisor.test.ts`.

## Design

Keep the existing extension source and implementation boundaries. Make the repository root an installable package by adding package metadata and an `omp.extensions` entry whose relative path points at `.omp/extensions/ask-agy.ts`. Include the extension module and its runtime source in the package files; include the README and license if one exists. Do not add dependencies unless the current package actually needs them at runtime. Keep Bun as the documented development/test runtime.

Update README installation instructions to describe GitHub installation with `omp install github:<owner>/<repo>#<immutable-tag>`, a new-session restart requirement, required `agy` CLI/model setup, and the fact that extension code has the host process privileges and forwards prompts to the agy upstream. Use the actual GitHub owner/repository when repository metadata establishes it; otherwise make the placeholders explicit. Retain concise local development instructions and current command/tool contracts.

## Behavior and safety constraints

- Do not change `/ask-agy`, tool parameter names, model selection, prompt behavior, process limits, or logging behavior as part of packaging.
- The extension package remains unsandboxed and relies on a local authenticated `agy` CLI.
- No marketplace catalog, npm publication, new capability, or automatic release workflow is in scope.
- GitHub installs should use an immutable release tag for reproducibility.

## Verification

1. Run the existing Bun test suite.
2. Inspect the package tarball contents and confirm it contains the entrypoint and `src/advisor.ts` with no omitted runtime files.
3. Load the package root through the installed omp CLI in a fresh session or the supported non-interactive extension-loading path; verify extension discovery. Do not make a real upstream agy request for this smoke check.
4. Confirm README commands match the package metadata and documented omp install syntax.
