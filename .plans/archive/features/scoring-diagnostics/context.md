# Context For Scoring Diagnostics and Test Expansion

## Existing References

- `roundup-ingestion-investigation` in `.plans/features/popup-sidepanel-walkthrough/eval/session-state.md`
- Scoring formula documented in session-state root cause analysis

## Relevant Codepaths

### Scoring Pipeline (Change Target)
- `packages/shared/src/modules/coop/pipeline.ts:370-540` — stopwords, keywordBank, tokenize, scoreAgainstCoop
- `packages/shared/src/modules/coop/pipeline.ts:593-616` — interpretExtractForCoop, runPassivePipeline

### Template Corpus (Read-Only — Source for Stopword Derivation)
- `packages/shared/src/modules/coop/flows.ts:212-233` — deriveCoopSoul (fixed strings: toneAndWorkingStyle, usefulSignalDefinition, artifactFocus, whyThisCoopExists templates)
- `packages/shared/src/modules/coop/flows.ts:235-272` — deriveRitualDefinition (cadence, facilitator, named moments, capture posture)
- `packages/shared/src/modules/coop/flows.ts:274-392` — createInitialArtifacts (4 seed artifacts: Setup Insights, Coop Soul, Rituals, Seed Contribution — fixed titles, whyItMatters, suggestedNextStep, tags)

### Observation/Routing Pipeline (Test Target)
- `packages/extension/src/background/handlers/agent-observation-emitters.ts:13-53` — emitAgentObservationIfMissing, emitRoundupBatchObservation
- `packages/shared/src/modules/agent/agent.ts:70-90` — buildAgentObservationFingerprint
- `packages/extension/src/runtime/agent-runner-inference.ts:114-143` — inferTabRoutingsHeuristically
- `packages/extension/src/runtime/agent-runner-skills.ts:693-889` — persistTabRouterOutput (TAB_ROUTER_DRAFT_THRESHOLD = 0.18)

### Existing Tests (Extend)
- `packages/shared/src/modules/coop/__tests__/pipeline.test.ts` — 16 tests (sports coop, dedup, transcript)
- `packages/extension/src/background/handlers/__tests__/agent-observation-emitters.test.ts` — 2 tests (candidate IDs, recapture fingerprint)
- `packages/extension/src/runtime/__tests__/agent-runner-inference.test.ts` — 3 tests (eligibility, relevance, memory tags)

## Template Corpus Token Inventory

Fixed boilerplate strings that appear in every coop regardless of user input:

**From deriveCoopSoul:**
- `"Warm, observant, playful on the surface, serious in the shared work."` (toneAndWorkingStyle)
- `"Artifacts that tighten shared context, surface opportunities, and reduce repeated research."` (usefulSignalDefinition)
- `['insights', 'funding leads', 'evidence', 'next steps']` (artifactFocus)
- `"{coopName} exists to turn loose tabs into {focusByType}."` (whyThisCoopExists — 5 spaceType variants)

**From createInitialArtifacts (fixed):**
- Titles: `"Setup Insights"`, `"Coop Soul"`, `"Rituals"`
- Tags: `['purpose', 'signal', 'tone']`, `['ritual', 'review', 'manual-round-up']`, `['seed', 'intro']`
- whyItMatters: 4 fixed strings per artifact
- suggestedNextStep: 4 fixed strings + 5 spaceType variants
- Summary (Rituals): `"Weekly review and explicit push define the shared-memory membrane."`
- domain: `"coop.local"` (all initial artifacts)

**From deriveRitualDefinition:**
- Cadence names (5 spaceType variants)
- Facilitator expectations (5 spaceType variants)
- Named moments (5 spaceType variants + "Manual round-up")
- Capture posture (2 variants: manual vs scheduled)

## Constraints

- Scoring internals must stay fast — no async, no Dexie, no regex engines
- `diagnoseKeywordBank` is a pure function — no side effects
- Stopword computation is a build-time/import-time constant — not computed per-call
- New exports must not break existing barrel chain: `pipeline.ts` → `coop/index.ts` → `shared/index.ts`
- Template corpus functions (flows.ts) are read-only for this feature — only pipeline.ts changes

## Notes For Agents

- Build `buildTemplateCorpusStopwords()` by running the template functions with dummy inputs and tokenizing the result. Union with base English 3-letter stopwords.
- `keywordBank` return type should stay `string[]` for backward compat; `diagnoseKeywordBank` returns the richer breakdown.
- Test files: new `scoring.test.ts` for Tiers 1-2, expand existing `agent-observation-emitters.test.ts` for Tier 3, new `pipeline-integration.test.ts` or section in existing `pipeline.test.ts` for Tier 4.
