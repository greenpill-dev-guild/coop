# Hackathon Release Readiness

**Feature**: `hackathon-release-readiness`
**Status**: Draft
**Source Branch**: `main`
**Created**: `2026-03-30`
**Last Updated**: `2026-03-30`

## Summary

Short statement of the user problem and expected outcome.

## Why Now

- Why this feature matters now
- What pressure, opportunity, or bug is driving it

## Scope

### In Scope

- Primary slice to ship

### Out Of Scope

- Explicitly deferred items

## User-Facing Outcome

- What changes for the user
- What stays the same

## Technical Notes

- Primary packages expected to change
- Shared module boundaries that matter
- Integration or migration constraints

## Lane Split

| Lane | Agent | Expected Scope |
|------|-------|----------------|
| UI | Claude | Screens, components, CSS, interaction polish, UX copy |
| State | Codex | Shared state, runtime orchestration, persistence, messages |
| API | Codex | `packages/api`, routes, payload contracts, integration wiring |
| Contracts | Codex | Onchain modules, typed intents, permissions, schemas |
| QA 1 | Claude | UX, behavior, regressions, E2E confidence |
| QA 2 | Codex | State/API/contracts regressions and final verification |

## Acceptance Criteria

- [ ] User-visible outcome is correct
- [ ] Shared/domain logic lives in `@coop/shared` when appropriate
- [ ] Tests and validation tier are defined
- [ ] QA handoff order is explicit

## Validation Plan

- Unit:
- Integration:
- E2E:
- Manual:

## References

- Related docs:
- Relevant files:
- Open questions:
