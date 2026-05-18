# Regen Community Evals

**Feature**: `regen-community-evals`
**Status**: Active
**Source Branch**: `feature/hackathon-simplify`
**Created**: `2026-05-17`
**Last Updated**: `2026-05-17`

## Summary

Turn the Gemma 4 Good hackathon framing into a durable eval suite for Coop: four regenerative
community archetypes, four opportunities for action, 32+ cases, action-brief outputs, and required
Gemma 4 model-in-loop proof in a real Chromium-family browser.

## Why Now

- The Kaggle demo needs confidence that Coop can synthesize regenerative community knowledge, not
  only route generic grant leads.
- The Santa Ana Watershed demo should be grounded as the land/watershed hero row while the evals
  prove the broader community pattern.
- Future work needs a plan-hub truth surface instead of relying on chat context or flat hackathon
  notes.

## Scope

### In Scope

- Full 4x4 regenerative eval matrix:
  - land and watershed stewards
  - community food and agroecology groups
  - mutual-aid and local resilience networks
  - community energy and circular infrastructure teams
  - coordinate people, preserve evidence, find support, share learning
- At least 32 deterministic cases: canonical plus stress/privacy/noise variant for every group and
  action pair.
- Action-brief assertions for target coop, action type, public summary, private notes, evidence
  references, coordinate/evidence/support/learning sections, tags, and disallowed claims.
- Required browser Gemma 4 model-in-loop proof that initializes the MV3 sandbox and writes JSON
  evidence under `.plans/evidence/`.

### Out Of Scope

- New public UI surfaces beyond existing Coop review/feed flows.
- New API, onchain, or contract capabilities.
- Treating Santa Ana Watershed as the whole product story.

## User-Facing Outcome

- The demo can show one grounded local watershed flow while the eval suite proves the pattern
  applies to multiple regenerative community types.
- Coop reviewers can verify that synthesis stays source-backed, privacy-preserving, and action
  oriented before publish.

## Technical Notes

- Default deterministic coverage lives in `packages/shared/src/modules/coop/__tests__/`.
- Browser model-in-loop proof lives in `scripts/verify-gemma4-regen-evals.cjs` and requires a built
  extension plus a real Chromium-family browser with WebGPU/model support.
- `bun run validate regen-community-evals` is intentionally hardware-sensitive and must fail if
  Gemma 4 cannot load or produce valid action briefs.

## Lane Split

| Lane | Agent | Expected Scope |
|------|-------|----------------|
| UI | n/a | No new UI required for v1 eval proof |
| State | Codex | Deterministic eval fixtures, model-in-loop proof script, validation wiring |
| API | n/a | No server work |
| Contracts | n/a | No onchain work |
| Docs | Codex | Plan hub, demo/eval docs alignment, QA report scaffolding |
| QA 1 | Codex | Run deterministic and browser model-in-loop gates |
| QA 2 | Claude | Review demo coherence and user-facing wording after QA 1 |

## Acceptance Criteria

- [ ] New feature pack validates with `bun run plans validate`.
- [ ] Deterministic seeded eval covers at least 32 cases across the 4x4 matrix.
- [ ] Every case expects an action brief with public/private/evidence/action sections.
- [ ] Browser model-in-loop eval initializes Gemma 4 and writes `.plans/evidence/*regen-evals*.json`.
- [ ] `bun run validate regen-community-evals` fails if Gemma 4 cannot load or any action brief is
      invalid.

## Validation Plan

- Unit: `bun run test:unit:coop-seeded-eval`
- Deterministic eval: `bun run validate coop-seeded-eval`
- Build: `cd packages/extension && bun run build`
- Model-in-loop: `COOP_VERIFY_BROWSER=brave node scripts/verify-gemma4-regen-evals.cjs`
- Gate: `bun run validate regen-community-evals`
- Plans: `bun run plans validate`

## References

- `.plans/hackathon-closeout-runbook.md`
- `.plans/demo-shooting-script.md`
- `.plans/kaggle-submission-entry.md`
- `/Users/afo/Downloads/coop-gemma4good-santa-ana/02-santa-ana-watershed-demo-brief.md`
- `/Users/afo/Downloads/coop-gemma4good-santa-ana/03-eval-suite-outline.md`
