# QA Pass 2 — Claude

Branch: `handoff/qa-claude/agent-knowledge-sandbox`
Triggered by: QA Pass 1 complete

## UX Flow Verification

- [ ] First source onboarding: empty state → add source → progress → completion toast
- [ ] Source management: add, remove, refresh, toggle active — all states render correctly
- [ ] Agent draft with provenance: "Sourced from" section shows specific content references
- [ ] Agent draft without provenance: section hidden (tab captures, receiver captures)
- [ ] Confidence tooltip: hover shows breakdown (schema + content + precedent delta)
- [ ] Decision History: shows both actions taken AND skipped decisions
- [ ] Popup health: green/yellow/red states render correctly, click navigates to Nest

## Design Compliance (4-Lens Review)

- [ ] Lens 1 — Regenerative: No gamification, growth-agnostic stats, observant language
- [ ] Lens 2 — Spatial: Correct paradigm per surface, materials match density, hit targets >= 44px
- [ ] Lens 3 — Ecosystem: Agent state visible, cascade warnings on governing actions, surrogate marked
- [ ] Lens 4 — Compliance: Labels, focus states, color not sole indicator, tokens used, components reused

## Progressive Disclosure Verification

- [ ] Glance layer: Popup source dot visible without interaction
- [ ] Scan layer: Badge row on draft cards shows provenance + confidence
- [ ] Engage layer: "Sourced from" + "Track record" visible on card expand
- [ ] Deep dive layer: Decision History in Roost shows full reasoning traces

## Regression Checks

- [ ] Existing Chickens tab: draft cards without graph data render unchanged
- [ ] Existing Roost tab: Agent section works without graph data
- [ ] Existing Nest tab: Settings section unaffected
- [ ] Existing Popup: no layout changes when sources not configured
- [ ] No visual regressions on snapshot tests

## E2E Confidence

- [ ] Full flow: add source → agent ingests → draft created → provenance visible → approve → precedent recorded
- [ ] Source removal flow: remove → cascade warning → confirm → source gone → entities marked stale
- [ ] Multi-source enrichment: draft references entities from multiple sources
