---
feature: scoring-diagnostics
title: Scoring diagnostics, automated stopwords, and test expansion
lane: state
agent: claude
status: done
source_branch: feature/scoring-diagnostics
work_branch: claude/state/scoring-diagnostics
depends_on:
  - ../spec.md
owned_paths:
  - packages/shared/src/modules/coop/pipeline.ts
  - packages/shared/src/modules/coop/__tests__/scoring.test.ts
  - packages/extension/src/background/handlers/__tests__/agent-observation-emitters.test.ts
  - packages/extension/src/runtime/__tests__/agent-runner-inference.test.ts
done_when:
  - diagnoseKeywordBank
  - buildTemplateCorpusStopwords
  - scoring.test.ts
skills:
  - testing
  - shared
updated: 2026-04-01
---

# Scoring Diagnostics — State Lane

## Batch 1: Exports and Stopword Automation (Steps 1-3)

### Step 1: Export scoring internals from pipeline.ts
- [x] Add `export` to `keywordBank`, `scoreAgainstCoop`, `tokenize` in `pipeline.ts`
- [x] Verify they auto-flow through the barrel chain: `coop/index.ts` → `shared/index.ts`
- [x] Run `bun run validate typecheck` to confirm no type conflicts
- Files: `packages/shared/src/modules/coop/pipeline.ts`
- Verify: `bun run validate typecheck`

### Step 2: Build automated stopword generator
- [x] Add `buildTemplateCorpusStopwords()` in `pipeline.ts` that:
  - Calls `deriveCoopSoul` with a dummy coop config for each of the 5 spaceTypes
  - Calls `createInitialArtifacts` with a dummy config
  - Calls `deriveRitualDefinition` with a dummy config for each spaceType
  - Tokenizes all generated text (lowercase, split on `[^a-z0-9]+`, length > 2)
  - Collects tokens that appear in ≥ 3 of the 5 spaceType variants (80% threshold adjusted for 5 variants)
  - Unions with a small base English 3-letter stopword list (the/and/for/are/but/not/etc.)
  - Returns a `Set<string>`
- [x] Export `buildTemplateCorpusStopwords` from pipeline.ts
- [x] Compute `TEMPLATE_CORPUS_STOPWORDS` as a module-level constant using the generator
- [x] Replace hand-curated `KEYWORD_BANK_STOPWORDS` with `TEMPLATE_CORPUS_STOPWORDS`
- [x] Verify existing pipeline tests still pass
- Files: `packages/shared/src/modules/coop/pipeline.ts`
- Verify: `bun run test -- packages/shared/src/modules/coop/__tests__/pipeline.test.ts`

### Step 3: Build diagnoseKeywordBank() diagnostic export
- [x] Add `diagnoseKeywordBank(coop: CoopSharedState)` in `pipeline.ts` returning:
  ```typescript
  {
    tokens: string[];
    tokenCount: number;
    sources: {
      purpose: string[];    // from profile.name + profile.purpose
      soul: string[];       // from soul fields
      setup: string[];      // from setupInsights.lenses
      artifacts: string[];  // from artifact titles/summaries/tags
      memory: string[];     // from topDomains/topTags
    };
    boilerplateFiltered: string[];  // tokens that were in the text but removed by stopwords
    boilerplateRatio: number;       // filtered / (filtered + kept)
  }
  ```
- [x] Implement by running each source layer through tokenize + stopword filter independently
- [x] Export from pipeline.ts
- Files: `packages/shared/src/modules/coop/pipeline.ts`
- Verify: `bun run validate typecheck`

## Batch 2: Tier 1 — Scoring Internals Tests (Steps 4-5)

### Step 4: Create scoring.test.ts with tokenize and keywordBank tests
- [x] Create `packages/shared/src/modules/coop/__tests__/scoring.test.ts`
- [x] `describe('tokenize')`:
  - `it('splits text into lowercase word tokens')` — "Hello World" → {"hello", "world"}
  - `it('handles empty and null-ish input')` — "" → empty set
  - `it('strips punctuation and special characters')` — "it's a test!" → {"its", "test"}
  - `it('preserves 3-letter acronyms')` — "NBA and NFL" → {"nba", "and", "nfl"}
  - `it('does not produce substring matches')` — "unbalanced" → {"unbalanced"}, not {"nba"}
- [x] `describe('keywordBank')`:
  - `it('includes user-supplied purpose terms')` — "Sports news" coop → bank includes "sports", "news"
  - `it('excludes template boilerplate stopwords')` — bank does NOT include "coop", "tabs", "loose", "tighten"
  - `it('preserves 3-letter domain acronyms')` — "NBA coverage" purpose → "nba" in bank
  - `it('returns empty array when coop has no meaningful terms')` — minimal edge case
  - `it('includes memory profile domains and tags')` — coop with topDomains/topTags populated
  - `it('deduplicates tokens across source layers')` — "sports" appears in purpose AND soul → appears once
- Files: `packages/shared/src/modules/coop/__tests__/scoring.test.ts`
- Verify: `bun run test -- packages/shared/src/modules/coop/__tests__/scoring.test.ts`

### Step 5: Add scoreAgainstCoop tests
- [x] `describe('scoreAgainstCoop')` in scoring.test.ts:
  - `it('returns 0.08 floor for empty keyword bank')`
  - `it('scores title matches at 0.12 per keyword')`
  - `it('scores body matches at 0.04 per keyword')`
  - `it('caps domain boost at 3 * 0.06 = 0.18')`
  - `it('applies coverage bonus when bodyMatches >= 2 and ratio >= 0.15')`
  - `it('does NOT apply coverage bonus with only 1 body match')`
  - `it('does NOT apply coverage bonus when ratio < 0.15 (large bank)')`
  - `it('clamps score to 0.98 ceiling')`
  - `it('scores a clearly relevant page above 0.18 draft threshold')` — NBA article vs sports coop
  - `it('scores an unrelated page below 0.18 draft threshold')` — cooking article vs sports coop
- Files: `packages/shared/src/modules/coop/__tests__/scoring.test.ts`
- Verify: `bun run test -- packages/shared/src/modules/coop/__tests__/scoring.test.ts`

## Batch 3: Tier 2 — Keyword Bank Composition + Diagnostics Tests (Steps 6-7)

### Step 6: Add diagnoseKeywordBank and composition tests
- [x] `describe('diagnoseKeywordBank')` in scoring.test.ts:
  - `it('breaks down tokens by source layer')` — purpose tokens in sources.purpose, soul in sources.soul, etc.
  - `it('reports boilerplate ratio correctly')` — boilerplateRatio = filtered / (filtered + kept)
  - `it('lists filtered stopwords in boilerplateFiltered')`
  - `it('returns consistent results for the same coop')` — deterministic
- [x] `describe('keyword bank composition')`:
  - `it('minimal "Sports news" coop preserves domain intent')` — bank includes "sports", "news"
  - `it('rich watershed coop produces 40+ unique tokens')` — bank.length > 40
  - `it('coop with "NBA" in purpose preserves 3-letter acronym')` — "nba" in bank
  - `it('initial artifacts contribute tags to keyword bank')` — seed artifact tags present
  - `it('template boilerplate does not dominate the bank')` — boilerplateRatio < 0.5 for a focused coop
  - `it('memory topDomains contribute to keyword bank')` — manually seeded domain appears
- Files: `packages/shared/src/modules/coop/__tests__/scoring.test.ts`
- Verify: `bun run test -- packages/shared/src/modules/coop/__tests__/scoring.test.ts`

### Step 7: Add buildTemplateCorpusStopwords tests
- [x] `describe('buildTemplateCorpusStopwords')` in scoring.test.ts:
  - `it('includes base English stopwords')` — "the", "and", "for" present
  - `it('includes template boilerplate tokens')` — "tighten", "loose", "membrane" present
  - `it('excludes domain-specific acronyms')` — "nba", "nfl", "api" NOT present
  - `it('excludes short domain words')` — "mlb", "ufc" NOT present (they're real domain terms)
  - `it('produces a stable result across calls')` — same Set each time
- Files: `packages/shared/src/modules/coop/__tests__/scoring.test.ts`
- Verify: `bun run test -- packages/shared/src/modules/coop/__tests__/scoring.test.ts`

## Batch 4: Tier 3 — Observation Emission and Dedup Tests (Step 8)

### Step 8: Expand observation emitter tests
- [x] Add to `packages/extension/src/background/handlers/__tests__/agent-observation-emitters.test.ts`:
  - `it('returns null when extractIds is empty')` — early exit check
  - `it('returns null when eligibleCoopIds is empty')` — early exit check
  - `it('deduplicates via fingerprint — same inputs produce same observation')` — emitAgentObservationIfMissing returns existing
  - `it('produces unique fingerprints for different extract sets')`
- [x] Optionally add to `packages/extension/src/runtime/__tests__/agent-runner-inference.test.ts`:
  - `it('produces no routings when eligible coops list is empty')`
  - `it('scores sports-focused extract higher for sports coop than generic coop')`
- Files: `packages/extension/src/background/handlers/__tests__/agent-observation-emitters.test.ts`, `packages/extension/src/runtime/__tests__/agent-runner-inference.test.ts`
- Verify: `bun run test -- packages/extension/src/background/handlers/__tests__/agent-observation-emitters.test.ts packages/extension/src/runtime/__tests__/agent-runner-inference.test.ts`

## Batch 5: Tier 4 — End-to-End Integration Test (Step 9)

### Step 9: End-to-end roundup → observation → routing → draft test
- [x] Add `describe('roundup ingestion end-to-end')` in `pipeline.test.ts`:
  - `it('produces a draft when a relevant page is routed to an aligned coop')`:
    - Create a sports coop via `createCoop()`
    - Build a sports page extract via `buildReadablePageExtract()`
    - Run `interpretExtractForCoop()` to get interpretation
    - Assert `relevanceScore >= 0.18` (draft threshold)
    - Call `shapeReviewDraft()` to produce draft
    - Assert draft has correct `suggestedTargetCoopIds`, `category`, `tags`
    - Assert draft `whyItMatters` mentions the coop name
  - `it('does not produce a draft for an unrelated page')`:
    - Same sports coop + cooking page extract
    - Assert `relevanceScore < 0.18`
  - `it('routes to the most relevant coop when multiple coops exist')`:
    - Sports coop + watershed coop + sports page extract
    - Assert sports coop gets higher score than watershed coop
- Files: `packages/shared/src/modules/coop/__tests__/pipeline.test.ts`
- Verify: `bun run test -- packages/shared/src/modules/coop/__tests__/pipeline.test.ts`

## Batch 6: Final Validation (Step 10)

### Step 10: Full regression check and cleanup
- [x] Run `bun run validate smoke` — all tests pass
- [x] Run `bunx @biomejs/biome check` on all changed files
- [x] Verify no pre-existing test regressions introduced
- [x] Remove any temporary debug logging
- [x] Update spec.md status to `Implemented`
- Verify: `bun run validate smoke`
