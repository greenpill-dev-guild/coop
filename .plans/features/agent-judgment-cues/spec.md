# Passive Judgment Cues

**Feature**: `agent-judgment-cues`
**Status**: Active
**Source Branch**: `main`
**Created**: `2026-04-18`
**Last Updated**: `2026-04-18`

## Summary

Turn ADR-009 into product behavior by attaching deterministic action-risk metadata to agent proposals
and queued action bundles, then surfacing that metadata inside the existing Roost and Nest review
cards.

## Why Now

- The harness already had proposal-first review boundaries, but users still had to infer which
  approvals were routine and which needed judgment.
- Agent output is now faster than review attention; passive cues keep low-risk work light while
  making live, permission, and destructive actions visibly heavier.

## Scope

### In Scope

- shared `ActionRiskTag` schema and classifier
- proposal and bundle propagation of `riskTags` and `requiresExplicitAcknowledgement`
- deterministic review-summary and acknowledgement copy
- Roost and Nest card refinement using existing badges, helper text, and action rows
- targeted unit/component/integration coverage

### Out Of Scope

- new screens, tabs, modals, or standalone review components
- approval policy rewrites or auto-run eligibility changes
- API or contract changes

## User-Facing Outcome

- low-risk chores keep the same lightweight review flow
- publish, sync, archive, permission, destructive, and live actions now show passive risk badges and
  one-line review framing
- high-risk approvals and executions require a narrow inline acknowledgement before the primary
  button enables

## Technical Notes

- Shared risk logic lives in `@coop/shared` policy helpers so the harness, queue, and UI all use
  one classifier.
- Proposal creation and bundle persistence both recompute risk metadata deterministically from
  `actionClass` plus runtime onchain mode.
- UI aggregation happens from proposal-level tags; no new plan schema was added.

## Lane Split

| Lane | Agent | Expected Scope |
|------|-------|----------------|
| UI | Claude | Roost and Nest card copy, badge ordering, inline acknowledgement |
| State | Codex | risk schema, classifier, proposal/bundle propagation, helpers |
| API | Codex | n/a |
| Contracts | Codex | n/a |
| QA 1 | Codex | targeted tests plus `validate quick` and `validate smoke` |
| QA 2 | Claude | optional follow-on UX review |

## Acceptance Criteria

- [x] Action proposals and bundles persist deterministic risk metadata.
- [x] Roost shows “Needs Judgment” only when pending plans carry risk tags.
- [x] Nest helper plans and waiting chores render matching risk cues.
- [x] High-risk actions require inline acknowledgement before approval or execution.
- [x] `bun run validate quick` passes.
- [x] `bun run validate smoke` passes.

## Validation Plan

- **Unit**: risk classifier and formatter coverage
- **Integration**: handler coverage for proposal tagging and bundle persistence
- **Component**: Roost/Nest review-state and acknowledgement gating
- **Manual**: not required for this slice after smoke validation

## References

- `.plans/adr/ADR-009-agentic-development-friction.md`
- `docs/reference/agent-harness.md`
