---
title: "Testing Audit Prompt"
slug: /reference/hackathon-sprint-audit-prompts/testing
audience: builder
doc_type: prompt-pack
status: historical
---

# Testing Audit Prompt

<DocMeta />

This is an April 1, 2026 snapshot prompt. Refresh commands, coverage, file paths, and repo facts
against the live tree before reusing it.

```text
Audit this repo read-only and produce an Audit Memo focused on test quality, coverage, E2E depth, and full feature validation.

Repo: /Users/afo/Code/greenpill/coop
Snapshot context: April 1, 2026. Refresh the baseline against the live repo before treating any fact below as current.

Snapshot repo facts from April 1, 2026; refresh before use and treat as context, not proof:
- `bun run validate quick` passed on April 1, 2026.
- The April 1 root Vitest coverage summary was about `86.1%` lines, `86.1%` statements, `86.23%` functions, and `77.04%` branches.
- The E2E surface is present, but it is concentrated in a small set of Playwright specs under `e2e/`.

Operating rules:
- Stay read-only. Do not edit tests, snapshots, or config.
- Read configuration and existing tests before drawing conclusions.
- Distinguish documented validation intent from current implementation.
- For every material claim, cite at least one file path and one command you ran.
- If you do not run a suite yourself, mark it unverified.

Start by reading:
- `/Users/afo/Code/greenpill/coop/AGENTS.md`
- `/Users/afo/Code/greenpill/coop/package.json`
- `/Users/afo/Code/greenpill/coop/vitest.config.ts`
- `/Users/afo/Code/greenpill/coop/playwright.config.cjs`
- `/Users/afo/Code/greenpill/coop/scripts/validate.ts`
- `/Users/afo/Code/greenpill/coop/docs/reference/testing-and-validation.md`
- `/Users/afo/Code/greenpill/coop/coverage/coverage-summary.json`

Then inspect:
- `e2e/*.cjs`
- targeted unit script entries in `package.json`
- major test-heavy domains in `packages/shared`, `packages/extension`, `packages/app`, and `packages/api`

Required checks:
1. Evaluate the balance between unit, integration, browser E2E, visual regression, and end-to-end feature validation.
2. Identify major user flows that have strong coverage and major flows that still rely on inference or mock-heavy confidence.
3. Review whether coverage totals accurately represent the repo or only selected surfaces.
4. Review whether validation suites in `scripts/validate.ts` are coherent, well layered, and mapped to real release confidence.
5. Produce a feature-to-test matrix that covers at least:
   - popup capture flows
   - sidepanel review and coop management
   - receiver pairing and intake sync
   - agent loop
   - shared sync/runtime health
   - release/readiness gating
6. Call out excluded or weakly covered runtime surfaces, especially if they are high-risk.

Suggested commands:
- `sed -n '1,240p' vitest.config.ts`
- `sed -n '1,240p' playwright.config.cjs`
- `sed -n '1,260p' scripts/validate.ts`
- `for f in e2e/*.cjs; do echo "--- $f ---"; rg -n "test\\(|@[-a-z]+" "$f"; echo; done`
- `node -e "const s=require('./coverage/coverage-summary.json').total; console.log(JSON.stringify(s,null,2))"`
- `rg -n "(describe\\(|test\\(|it\\()" packages e2e --glob '!**/node_modules/**' --glob '!**/dist/**'`

Deliverable format:

# Audit Memo

## Current State
- Summarize the test strategy that the repo appears to intend.
- Summarize the test strategy the repo actually has today.

## Coverage And Validation Map
- Provide a feature-to-test matrix with:
  - feature area
  - unit or integration coverage
  - E2E coverage
  - gaps
  - recommended validation command

## Findings
- Order findings by severity.
- For each finding include evidence from config, test files, and commands.

## Strengths Worth Preserving
- Call out what the repo is already doing well in validation and test design.

## Gaps Or Unknowns
- Name anything that remains unverified because you did not run it.

## Prioritized Next Steps
- Give a short list of next steps with rationale.

Hard requirements:
1. End with top findings ordered by severity.
2. Include strengths worth preserving.
3. Include gaps or unknowns.
4. Include prioritized next steps with short rationale.
5. Explicitly separate documented intent from current implementation.
```
