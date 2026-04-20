# Implementation Notes

## Current Intent

Use this feature pack as the single orchestration board for the hackathon release push. The pack is
organized by category and by agent ownership so Claude can conduct work without overlapping Codex
lanes.

## Lane Board

| Lane File | Agent | Category | Status | Phase |
|-----------|-------|----------|--------|-------|
| `lanes/state.codex.todo.md` | Codex | bugs | done | 1 |
| `lanes/api.codex.todo.md` | Codex | bugs | done | 1 |
| `lanes/contracts.codex.todo.md` | Codex | bugs | done | 1 |
| `lanes/docs.claude.todo.md` | Claude | documentation | done | 1 and 4 |
| `lanes/ui.claude.todo.md` | Claude | polish | done | 2 |
| `qa/qa-codex.todo.md` | Codex | testing | done | 3 |
| `qa/qa-claude.todo.md` | Claude | testing | done | 3 |

## Phase 1 Findings

### State Lane (Codex)

- Popup create no longer auto-enables Green Goods; both paths send config only on explicit opt-in.
- Added shared passkey trust explainer copy to create/join flows.
- Preview metadata (favicon, socialPreviewImageUrl) now survives capture through review.
- New `resolvePreviewCardImageUrl()` helper for UI fallback logic.
- Targeted Vitest passed; popup E2E failed only due to sandbox Chromium limitations.

### API Lane (Codex)

- Sync health is now aggregated across all bound coops — one healthy coop no longer masks degraded.
- Stale invite state cleared on revoke; selected receiver pairing marked active immediately.
- New test coverage for invite lifecycle and multi-coop sync health.

### Contracts Lane (Codex)

- Filecoin registry registration no longer invents a mock success path when live onchain mode or
  live registry material is missing.
- Live Filecoin registration is now limited to live archive receipts produced from an
  operator-controlled live build.
- The archive live probe now requires real trusted-node archive env by default; the old fallback is
  available only through the explicit `COOP_ALLOW_ARCHIVE_PROBE_FALLBACK=true` wiring-check escape
  hatch.
- Operator docs now include an explicit registry deployment and live-rails checklist.
- The previous contract blurred operator-only live rails and mock-first staged-launch behavior by
  treating missing Filecoin registry config as a successful mock registration.
- `validate:archive-live` could also pass on a fallback delegation, which made the live gate look
  greener than it really was.

### Docs Lane (Claude)

- Landing page: topbar nav with Install Extension CTA, footer install links.
- Install docs: restructured with fastest-path 4-command install, clearer dev/zip paths.
- Demo storyboard: 7-beat flow (~7 min total).
- Strategic narrative: four bets, core tenets, monetization — all provisional.

## Follow-Ups

- Populate `packages/shared/src/modules/fvm/fvm.ts` with the canonical live registry deployment
  only after the deployment is actually finalized and verified.
- Keep Filecoin registry registration gated in QA until the operator checklist is completed end to
  end.
- `validate:production-readiness` and `archive-live` blocked on pre-existing Biome lint failures
  in unrelated files — needs a baseline lint fix pass.

## Claude -> Codex Execution Pattern

1. Discover runnable lanes:

```bash
bun run plans queue --agent codex --json
bun run plans queue --agent claude --json
bun run plans queue --agent claude --lane docs --json
```

Filter those results to the `hackathon-release-readiness` feature only. Do not start unrelated
ready items from other feature packs.

2. Run Codex with `gpt-5.4` and lane-specific effort:

```bash
cat .plans/features/hackathon-release-readiness/lanes/state.codex.todo.md | codex exec -C /Users/afo/Code/greenpill/coop -m gpt-5.4 -c model_reasoning_effort="high" -
cat .plans/features/hackathon-release-readiness/lanes/api.codex.todo.md | codex exec -C /Users/afo/Code/greenpill/coop -m gpt-5.4 -c model_reasoning_effort="high" -
cat .plans/features/hackathon-release-readiness/lanes/contracts.codex.todo.md | codex exec -C /Users/afo/Code/greenpill/coop -m gpt-5.4 -c model_reasoning_effort="xhigh" -
cat .plans/features/hackathon-release-readiness/qa/qa-codex.todo.md | codex exec -C /Users/afo/Code/greenpill/coop -m gpt-5.4 -c model_reasoning_effort="xhigh" -
```

3. Treat `medium` as out of scope for this sprint. Use `high` for standard implementation work and
   `xhigh` only for live-rails, privacy/security, and final release gating.

## Mandatory Orchestration Rules

1. Use lane files as the source of truth, not memory or ad hoc task splitting.
2. Keep one active implementation agent per lane.
3. Run each active lane on its own `work_branch` in an isolated worktree or workspace.
4. Do not start blocked lanes early.
5. Update lane statuses as the sprint progresses.
6. Write validation findings and residual risks into `qa-report.md`.
7. If time pressure forces cuts, cut strategy and non-blocking polish before bug, testing, or
   install-path work.
8. If Codex fails due to quota, billing, auth, or rate-limit issues, stop Codex orchestration
   immediately, report the blocked lane, and wait for explicit user direction before resuming.
9. Assume the human operator is running the dev environment in a separate terminal.
10. Use that running dev environment for inspection and validation, but do not start or take over a
    long-lived dev process unless explicitly asked.
11. Pause for explicit human validation before crossing major phase boundaries.

## Strategy And UX Decisions Locked For This Pack

- Public narrative stays Coop-native and product-first.
- Standards backing should cite the Durgadas Coordination Structural Integrity Suite:
  https://github.com/durgadasji/standards
- The four strategic bets to describe after release are fixed:
  1. React Flow knowledge exploration
  2. Coop OS
  3. PWA upgrades
  4. Community coop calls with coop knowledge sharing
- Chickens review cards should stay fast-scan:
  - left preview rail
  - source row with favicon/domain cue
  - deeper rationale in expansion
  - push controls for drafts only
  - 0 targets: `Select coops`
  - 1 target: `Push to <Coop>`
  - 2-4 targets: equal target pills
  - 5+ targets: selector/dropdown
- Popup home yard should remain ambient delight:
  - slow deterministic motion
  - tooltip labels tied to real items
  - sound only on explicit interaction
  - no autonomous chirps or game-like loops

## Phase Notes

### Phase 1

- Start `state.codex`, `api.codex`, `contracts.codex`, and `docs.claude` in parallel.
- Do not start `ui.claude` implementation until the state and sync lanes stop moving shared
  contracts.
- At the end of Phase 1, stop and ask the human operator to validate the core flows in the running
  dev environment before starting Phase 2.

### Phase 2

- Run `ui.claude` after Phase 1 logic lanes are merged or otherwise stable.
- Keep the UI lane on extension surfaces only.
- At the end of Phase 2, stop and ask the human operator to validate the polished surfaces in the
  running dev environment before starting Phase 3.

#### UI Lane (Claude) — Phase 2 Findings

- **Chickens CompactCard**: Added left preview-image rail (uses `draft.previewImageUrl`), source row
  with favicon (Google favicon service) and domain link, and spec-aligned push controls (0 targets:
  disabled "Select coops"; 1 target: "Push to <Coop>"; 2-4 targets: equal pills; 5+: dropdown).
  Moved deeper rationale into the expansion section. Push controls render only for drafts per spec.
- **CompactSharedCard**: Same preview rail and source row treatment as review cards. Summary label
  changed from "More" to "Details" for clarity.
- **Roost tab**: Restructured from Green-Goods-heavy layout to action-first hierarchy. Hero card
  shows synthesis stats (signals, drafts, stale) in a 3-column stat strip with a primary "Review
  Chickens" CTA. Added recent activity section showing the last 3 artifacts. Green Goods section
  conditionally renders only when `greenGoods` exists on the coop, with clear disabled/enabled
  states. Removed duplicate "Quick Actions" card, consolidated provision button into Green Goods
  card. Capital & Payouts remains as a restrained stub.
- **Popup home**: Added gentle idle animation (1.5px vertical bob, 4s cycle) with staggered delays.
  Each chicken shows its title as a native tooltip on hover. `YardItem` interface now has an optional
  `title` field (not yet wired in orchestration — deferred, see lane defer list).
- **CSS additions**: New compact-card body/preview-rail/content/source-row/favicon/target-pill
  classes. New roost-hero-card/summary-strip/stat-cell/activity-list/activity-item/stub-card classes.
  Chicken idle animation keyframes added to popup.css.
- **Test fix**: `RoostTab-subheader.test.tsx` was missing `summary` and `onOpenSynthesisSegment`
  props (pre-existing gap); added them. All 59 assertions pass across 6 test files; 3 test files
  fail at Vite transform level (pre-existing `@coop/shared` schema resolution issue, not from UI
  changes).
- **Build**: Extension build passes cleanly.

### Phase 3

- Create `handoff/qa-codex/hackathon-release-readiness` when implementation is ready for technical
  QA.
- Create `handoff/qa-claude/hackathon-release-readiness` only after Codex QA is honest enough for
  final product review.
- Before presenting the release recommendation as complete, stop and ask the human operator for a
  final validation pass and release decision.

### Phase 4

- Finish strategy/roadmap docs only if the release candidate is already credible.
