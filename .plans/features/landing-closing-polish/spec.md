# Landing Closing Polish

**Feature**: `landing-closing-polish`
**Status**: Active
**Source Branch**: `feature/landing-closing-polish`
**Created**: `2026-05-26`
**Last Updated**: `2026-05-26`

## Summary

Preserve the existing flat landing closing-polish note as a canonical UI-only feature pack. The intended product work remains a tiny landing-page closeout improvement, but this migration does not implement it.

## Why Now

- `.plans/how-can-we-improve-cuddly-kahan.md` was the last flat active plan file and did not appear in automation queues.
- Moving it into `.plans/features/landing-closing-polish/` keeps `.plans` as the single live planning space without losing the prior implementation guidance.

## Scope

### In Scope

- Add one closing CTA inside the arrival scene.
- Add a footer credibility line and accessible resources label.
- Add minimal CSS polish for the CTA and footer metadata.

### Out Of Scope

- New landing sections, videos, email capture, testimonials, team grid, hackathon logo art, broad footer reorganization, or extra CTAs.
- State, API, contracts, docs, or runtime behavior changes.
- Implementing these UI edits as part of `agentic-flow-hardening`.

## User-Facing Outcome

- When implemented, visitors get a clearer closing action and light credibility cue.
- This migration changes only planning structure; shipped product UI stays the same until the UI lane is executed.

## Technical Notes

- Primary package for future implementation: `packages/app`.
- Expected files: `ArrivalJourneySection.tsx`, `Landing/index.tsx`, `translations.json`, and `styles.css`.
- The lane is UI-only and should not create new components, dependencies, API routes, shared state, or design tokens.

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

- [x] The flat legacy note is preserved in this feature pack.
- [ ] Closing CTA is visible in the arrival scene.
- [ ] Footer has brand/copyright plus credibility on the left and resource links on the right.
- [ ] No horizontal scroll or layout shift is introduced on desktop or mobile.
- [ ] `bun run validate quick` passes after UI implementation.

## Validation Plan

- Unit: none expected unless component logic changes.
- Integration: `bun run validate quick`.
- E2E/manual: desktop and mobile bottom-of-page screenshots; click the closing CTA and confirm it scrolls to `#ritual`.

## References

- Related docs: migrated from `.plans/how-can-we-improve-cuddly-kahan.md`.
- Relevant files: `packages/app/src/views/Landing/sections/ArrivalJourneySection.tsx`, `packages/app/src/views/Landing/index.tsx`, `packages/app/src/i18n/translations.json`, `packages/app/src/styles.css`.
- Open questions: None; original note already constrained budget and scope.
