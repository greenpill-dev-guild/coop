# QA Report For Agentic Flow Hardening

## Pre-Handoff Review

- Status: findings addressed in the hardening pass
- Commands:
  - `bun run plans:validate`
  - `bun run plans:legacy`
  - `bun run check:agentic-flow`
  - `git diff --check`
- Findings:
  - Hardened `check:agentic-flow` to scan package source and tests, including package-level test directories outside `src`.
  - Replaced regex-only import detection with TypeScript AST-based import extraction so multiline imports, exports, dynamic imports, and `require()` calls are visible.
  - Corrected QA ownership drift in templates and migrated feature specs so pass 1 is Codex and pass 2 is Claude.
  - Tightened `.claude/context/app.md` guidance around `@coop/shared/app` and receiver pairing routes.

## QA Pass 1: Codex

- Status: blocked until `handoff/qa-codex/agentic-flow-hardening` exists
- Commands:
- Findings:

## QA Pass 2: Claude

- Status: blocked until Codex QA creates `handoff/qa-claude/agentic-flow-hardening`
- Commands:
- Findings:

## Residual Risk

- The import-boundary check is advisory by default. `--strict` exists for a future opt-in gate after the team has watched advisory output on real work.
- Browser proof remains intentionally out of scope because this pass changed guidance, contracts, checks, and API parsing rather than rendered UI behavior.
