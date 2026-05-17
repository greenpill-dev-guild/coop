---
title: "CI/CD Audit Prompt"
slug: /reference/hackathon-sprint-audit-prompts/ci-cd
audience: builder
doc_type: prompt-pack
status: historical
---

# CI/CD Audit Prompt

<DocMeta />

This is an April 1, 2026 snapshot prompt. Refresh commands, coverage, file paths, and repo facts
against the live tree before reusing it.

```text
Audit this repo read-only and produce an Audit Memo focused on CI/CD quality, release safety, validation robustness, and operational clarity.

Repo: /Users/afo/Code/greenpill/coop
Snapshot context: April 1, 2026. Refresh the baseline against the live repo before treating any fact below as current.

Snapshot repo facts from April 1, 2026; refresh before use and treat as context, not proof:
- CI and release workflows live in `.github/workflows/`.
- Validation orchestration lives in `scripts/validate.ts`.
- Packaging and environment-profile behavior are driven by `package.json` scripts plus helper scripts.
- `bun run validate quick` passed on April 1, 2026, but deeper smoke, E2E, and live-rail confidence should be treated as unverified unless inspected directly.

Operating rules:
- Stay read-only.
- Review workflow definitions, validation scripts, and release scripts before drawing conclusions.
- Distinguish documented release intent from current implementation.
- For every material claim, cite at least one file path and one command you ran.
- Judge robustness by gate quality, coverage, release safety, rollback clarity, and failure modes.

Start by reading:
- `/Users/afo/Code/greenpill/coop/AGENTS.md`
- `/Users/afo/Code/greenpill/coop/package.json`
- `/Users/afo/Code/greenpill/coop/scripts/validate.ts`
- `/Users/afo/Code/greenpill/coop/docs/reference/testing-and-validation.md`
- `/Users/afo/Code/greenpill/coop/docs/reference/production-release-checklist.md`

Then inspect:
- `.github/workflows/ci.yml`
- `.github/workflows/deploy-api.yml`
- `.github/workflows/publish-builder-release.yml`
- `.github/workflows/release-extension.yml`
- relevant packaging or env-profile scripts if needed

Required checks:
1. Map the current CI/CD pipeline from pull request validation to releases and deploys.
2. Evaluate gate ordering, duplication, missing gates, and risky assumptions.
3. Review whether the pipeline meaningfully covers build, unit, E2E, visual, and release readiness.
4. Call out oddities such as mutating format commands inside CI validation if present.
5. Review artifact handling, release packaging, and rollback or re-run safety.
6. Recommend a hardened target pipeline, including what should remain optional, what should block, and what needs clearer rollback or operator guidance.

Suggested commands:
- `for f in .github/workflows/*.yml; do echo "--- $f ---"; sed -n '1,240p' "$f"; echo; done`
- `sed -n '1,320p' package.json`
- `sed -n '1,260p' scripts/validate.ts`
- `rg -n "validate|release|package|deploy|store-readiness|production-readiness" package.json scripts .github/workflows --glob '!**/node_modules/**'`
- `git log --since='8 days ago' --date=short --pretty=format:'%ad %h %s' --max-count=40`

Deliverable format:

# Audit Memo

## Current State
- Summarize the intended release and validation posture.
- Summarize the pipeline that is actually implemented.

## Pipeline Map
- Cover:
  - PR validation
  - main-branch validation
  - API deploy
  - extension packaging and release
  - builder prerelease flow

## Findings
- Order findings by severity.
- Support findings with workflow, script, and command evidence.

## Strengths Worth Preserving
- Call out release and validation choices that are already robust.

## Gaps Or Unknowns
- Note anything that remains unverified without actually running workflows or live rails.

## Prioritized Next Steps
- Provide a hardened target pipeline with short rationale.

Hard requirements:
1. End with top findings ordered by severity.
2. Include strengths worth preserving.
3. Include gaps or unknowns.
4. Include prioritized next steps with short rationale.
5. Explicitly separate documented intent from current implementation.
```
