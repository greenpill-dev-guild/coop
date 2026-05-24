# AI-Native Developer Workflow

**Feature**: `ai-native-dev-workflow`
**Status**: Active
**Source Branch**: `feature/ai-native-dev-workflow`
**Created**: `2026-05-24`
**Last Updated**: `2026-05-24`

## Summary

Turn Coop's already-strong agent workflow into a measurable AI-native operating system. Every active feature should make intent, agent delegation, verification evidence, human judgment, scorecards, adversarial review, and closeout proof easy to inspect.

## Why Now

Coop already has `.plans`, output contracts, review gates, agent role files, and local-first AI runtime work. The gap is not more documents; it is consistent evidence that delegation works and that repeated agent failures feed back into the system.

## Scope

### In Scope

- Agent Run Ledger for one active feature.
- Workflow Scorecard baseline for one recent feature.
- Read-only adversarial review pass.
- Closeout gate for spec, implementation, eval, and QA agreement.
- Rule feedback loop into existing Coop guidance or skills.

### Out Of Scope

- New runtime control-plane implementation.
- New hosted agent infrastructure.
- Replacing current `.plans` taxonomy.
- Editing product UI before a lane explicitly scopes it.

## User-Facing Outcome

Maintainers can see whether AI delegation improved the work or created review burden. Agents get a concrete evidence contract before claiming completion.

## Technical Notes

- Primary truth surface: `.plans/features/ai-native-dev-workflow/`.
- Existing references: `agent-control-plane`, `agent-judgment-cues`, `agent-knowledge-sandbox`, and `production-readiness`.
- This hub coordinates process artifacts only until a lane explicitly scopes code.

## Lane Split

| Lane | Agent | Expected Scope |
|------|-------|----------------|
| State | Codex | Ledger and scorecard artifacts, baseline feature selection, closeout evidence shape |
| UI | Claude | Human-readable handoff and review ergonomics, making the process usable |
| Docs | Codex | Smallest durable guidance update after week-five proof |
| QA 1 | Codex | Validate artifacts, plan truth, and adversarial-review evidence |
| QA 2 | Claude | Review usability, scope discipline, and cognitive-load impact |

## Acceptance Criteria

- [x] `bun run plans:validate` passes.
- [x] `artifacts/agent-run-ledger.md` has one filled entry for an active feature.
- [x] `artifacts/workflow-scorecard.md` has one baseline entry.
- [x] `reports/adversarial-review.md` has one read-only review result.
- [x] `eval/qa-report.md` confirms spec, lane notes, eval evidence, and QA notes agree.
- [x] Any repeated agent failure creates a targeted rule update or an explicit `None`.

## Validation Plan

- Plan integrity: `bun run plans:validate`
- Lightweight code-health gate when later guidance or runtime files change: `bun run validate quick`
- QA: compare ledger, scorecard, adversarial review, and closeout notes for agreement.
