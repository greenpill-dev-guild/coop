# <Feature Title>

**Feature**: `<feature-slug>`
**Status**: Draft
**Source Branch**: `<source-branch>`
**Created**: `<YYYY-MM-DD>`
**Last Updated**: `<YYYY-MM-DD>`

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

## Agent Readiness

- [ ] Data shape is described before implementation, including any Dexie/Yjs persisted-state impact.
- [ ] Validation boundary is named: Zod schema, runtime parser, route handler, or UI-only.
- [ ] Route or surface map is explicit, including public/private/legacy paths when relevant.
- [ ] Auth, session, permit, policy, and approval implications are called out or marked `None`.
- [ ] Client/server, extension/background, or sync message path is identified or marked `None`.
- [ ] UI/CSS primitives are chosen from existing design guidance before new styles are added.
- [ ] Folder placement and public import surface are named before new files are introduced.
- [ ] Verification tier is selected using the lightest tier that proves the touched surface.

## Lane Split

| Lane | Agent | Expected Scope |
|------|-------|----------------|
| UI | Claude | Screens, components, CSS, interaction polish, UX copy |
| State | Codex | Shared state, runtime orchestration, persistence, messages |
| API | Codex | `packages/api`, routes, payload contracts, integration wiring |
| Contracts | Codex | Onchain modules, typed intents, permissions, schemas |
| QA 1 | Codex | State/API/contracts regressions and first verification |
| QA 2 | Claude | UX, behavior, regressions, E2E confidence |

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
