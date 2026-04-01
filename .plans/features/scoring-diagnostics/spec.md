# Scoring Diagnostics and Test Expansion

**Feature**: `scoring-diagnostics`
**Status**: Implemented
**Source Branch**: `feature/scoring-diagnostics`
**Created**: `2026-04-01`
**Last Updated**: `2026-04-01`

## Summary

The roundup scoring pipeline (`keywordBank` → `scoreAgainstCoop` → `interpretExtractForCoop` → draft creation) has zero isolated unit test coverage on its core scoring functions. The keyword bank stopword list is hand-curated with no derivation from actual coop template text. When scoring produces unexpected results (like sports tabs not becoming chickens), there's no diagnostic tooling to explain why.

This feature adds:
1. A `diagnoseKeywordBank(coop)` diagnostic export that breaks down token composition by source layer
2. Automated stopword derivation from the coop template corpus, replacing the hand-curated list
3. Test coverage from scoring unit tests (Tier 1) through end-to-end pipeline integration (Tier 4)

## Why Now

- The roundup ingestion bug just exposed that `keywordBank` silently dropped 3-letter acronyms. The fix was manual — we need tests to catch scoring regressions.
- The hand-curated stopword list missed common 3-letter words and has no derivation trail. Future coop template changes will silently degrade scoring unless stopwords are computed from the template corpus.
- No existing test exercises `scoreAgainstCoop` or `keywordBank` in isolation — all scoring is tested indirectly through `runPassivePipeline`, making failures hard to diagnose.

## Scope

### In Scope

- Export and test `keywordBank`, `scoreAgainstCoop`, `tokenize` from `@coop/shared`
- New `diagnoseKeywordBank(coop)` function with per-source-layer token breakdown
- Automated stopword generation: `buildTemplateCorpusStopwords()` that derives boilerplate tokens from `deriveCoopSoul` + `createInitialArtifacts` + ritual templates
- Tier 1: Scoring internals unit tests (edge cases, boundary conditions, coverage bonus math)
- Tier 2: Keyword bank composition tests (minimal coop, rich coop, acronym preservation)
- Tier 3: Observation emission/dedup tests (fingerprint stability, cooldown, empty inputs)
- Tier 4: End-to-end roundup → observation → routing → draft creation integration test

### Out Of Scope

- Scoring UI in the extension (Chickens "why this scored X?" view) — separate feature
- `vocabularyTerms` / `prohibitedTopics` integration into scoring — fields exist but are unused
- Per-coop adaptive threshold (replacing the fixed 0.18) — follow-up work
- Changes to `classifyLenses()` or `classifyCategory()` substring matching

## User-Facing Outcome

- No user-visible changes — this is infrastructure and test coverage
- Future scoring regressions caught before they reach users
- `diagnoseKeywordBank()` available for agent self-diagnostics and future UI features

## Technical Notes

- Primary package: `@coop/shared` (pipeline.ts, new scoring-diagnostics.ts)
- Test package: `@coop/shared` (pipeline tests) + `extension` (observation/routing tests)
- `keywordBank`, `scoreAgainstCoop`, `tokenize` become exported functions
- Stopword list transitions from a hand-curated `Set` to a computed `Set` derived from template corpus + a small base English stopword list
- No barrel changes needed — exports auto-flow through existing `coop/index.ts` → `shared/index.ts`

## Lane Split

| Lane | Agent | Expected Scope |
|------|-------|----------------|
| State | Claude | Diagnostic export, stopword generation, scoring exports, all test tiers |

Single-lane feature — all work is in `@coop/shared` pipeline internals and test files. No UI, no API, no contracts.

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Export scoring internals directly | Tests need isolated access; `interpretExtractForCoop` wraps too much to test edge cases |
| 2 | Compute stopwords from template corpus | Hand-curated list drifts when templates change; computed list stays in sync |
| 3 | Keep base English stopwords as a separate small list | Template-derived stopwords won't catch "the", "and" — need both layers |
| 4 | `diagnoseKeywordBank` returns source-layer breakdown | Enables both test assertions and future agent self-diagnostics |
| 5 | Test through real `createCoop()` not mocked state | Ensures tests catch template-generated boilerplate drift |
| 6 | Single lane, not split | All work is in shared scoring internals — no cross-package coordination needed |

## Acceptance Criteria

- [ ] `keywordBank`, `scoreAgainstCoop`, `tokenize` exported from `@coop/shared`
- [ ] `diagnoseKeywordBank(coop)` returns per-source token breakdown, boilerplate ratio, filtered stopwords
- [ ] `buildTemplateCorpusStopwords()` derives stopwords from actual template functions
- [ ] `KEYWORD_BANK_STOPWORDS` replaced with computed stopwords (template-derived + base English)
- [ ] Tier 1: 10+ unit tests covering scoring formula edge cases
- [ ] Tier 2: 6+ tests verifying keyword bank composition for known coop configs
- [ ] Tier 3: 4+ tests for observation emission dedup and fingerprint stability
- [ ] Tier 4: 1+ end-to-end integration test (roundup → observation → routing → draft)
- [ ] All pre-existing tests pass with no regressions
- [ ] `bun run validate smoke` passes

## Validation Plan

- Unit: `bun run test -- packages/shared/src/modules/coop/__tests__/scoring.test.ts`
- Integration: `bun run test -- packages/extension/src/background/handlers/__tests__/agent-observation-emitters.test.ts packages/extension/src/runtime/__tests__/agent-runner-inference.test.ts`
- Smoke: `bun run validate smoke`
- Manual: N/A (no UI changes)

## References

- Relevant files:
  - `packages/shared/src/modules/coop/pipeline.ts` (scoring functions)
  - `packages/shared/src/modules/coop/flows.ts` (template corpus: deriveCoopSoul, createInitialArtifacts, deriveRitualDefinition)
  - `packages/shared/src/modules/agent/agent.ts` (observation fingerprints)
  - `packages/extension/src/background/handlers/agent-observation-emitters.ts`
  - `packages/extension/src/runtime/agent-runner-inference.ts`
  - `packages/extension/src/runtime/agent-runner-skills.ts` (persistTabRouterOutput, thresholds)
- Prior work: `roundup-ingestion-investigation` task in popup-sidepanel-walkthrough session-state
