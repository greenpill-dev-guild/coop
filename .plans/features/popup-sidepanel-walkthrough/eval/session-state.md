# Popup + Side Panel Walkthrough Session State

Created: 2026-03-31
Last compacted: 2026-03-31
Feature slug: `popup-sidepanel-walkthrough`
Archived history: `/Users/afo/Code/greenpill/coop/.plans/features/popup-sidepanel-walkthrough/eval/session-state.archive-2026-03-31.md`

## Purpose

This is the short working brief for remaining walkthrough tasks. The full per-task history was archived to keep this file readable.

## Working Rules

- Read this file before touching code.
- Append new notes only under `## Active Log`.
- Do not revert unrelated local changes; adapt and document tensions.
- If you touch a shared surface, scan the completed-summary and overlap sections first.
- Record exact validation commands and outcomes.

## Product Decisions

- Notifications must be non-blocking overlays/toasts. They must not push popup or sidepanel layout.
- Draft capture is pre-coop. Use Chickens/draft language, not direct-save-to-coop language.
- Popup home should remain responsive during long-running actions. Roundup should be passive, not globally blocking.
- Manual capture intent should be respected. Dedupe should mainly suppress accidental immediate repeats.
- Shared capture review should stay aligned across file, screenshot, and audio flows.
- Image/audio preview should appear where technically reasonable.
- The user-facing Chickens review surface should converge on one compact card contract:
  - title
  - why it matters
  - tags
  - push controls
  - preview media where applicable
- User-ingested captures and tab/agent-ingested signals may remain different internal objects, but they should synthesize into the same review format before the user is asked to review or push.

## Current Baseline

- Popup and sidepanel notifications are normalized onto the shared toast path.
- Popup roundup is passive and no longer freezes unrelated actions.
- Roundup broad-host permission fallback routes into sidepanel Chickens permission flow.
- Shared capture review dialog supports image preview, file summary, draft language, and client-side large-image compression.
- Audio permission handling is classified more precisely and audio review supports inline audio preview.
- Manual tab recapture is supported with a short accidental-repeat suppression window.
- Roundup ingestion for focused coops was improved by fixing keyword-bank/scoring behavior.
- Chickens feed rendering was toned down and compacted.
- Signals and drafts now converge more cleanly into one Chickens review-card model.
- Sidepanel agent buttons now have real running state and outcome-specific feedback.

## Completed Work Summary

- `notifications-normalization`
  - Popup/sidepanel transient feedback uses the shared non-blocking toast path.
- `popup-roundup-concurrency`
  - Roundup no longer disables unrelated capture actions.
- `roundup-permission-proactive`
  - Missing broad roundup access now routes into sidepanel permission handling instead of popup permission requests.
- `shared-capture-dialog-cleanup`
  - File/screenshot review dialog uses draft language, previews, and no overflow.
- `audio-permission-flow`
  - Audio start failures are classified accurately and audio review has inline audio preview.
- `manual-tab-capture-dedupe`
  - Explicit second-click recapture works; accidental immediate repeats are still suppressed.
- `roundup-ingestion-investigation`
  - Focused-coop tab routing improved via keyword-bank and scoring fixes.
- `chickens-feed-tone-down`
  - Chickens cards are calmer, more compact, and orientation items are grouped.
- `signal-draft-consolidation`
  - Signals and drafts now share one primary review-card model in Chickens.
- `sidepanel-agent-actions-wiring`
  - Sidepanel agent actions are wired, disabled while running, and report real outcomes.

## Remaining Tasks

All walkthrough tasks complete. No remaining implementation work.

## Open Follow-Ups

- Roundup summary messaging still conflates “tabs captured” with “drafts/signals ready”.
- `ProactiveSignal` does not currently carry a favicon field even though Chickens attempts to read one.
- Orphan signal promotion currently creates `workflowStage: 'ready'`; if product wants a candidate step first, adjust intentionally.
- `agent-observation-conditions.test.ts` is a known pre-existing failing baseline outside this walkthrough.

## Overlap Hotspots

- Walkthrough-heavy shared surfaces:
  - `packages/extension/src/runtime/messages.ts`
  - `packages/extension/src/views/Popup/PopupScreenRouter.tsx`
  - `packages/extension/src/views/Popup/hooks/usePopupOrchestration.ts`
  - `packages/extension/src/views/Sidepanel/tabs/ChickensTab.tsx`
  - `packages/extension/src/views/Sidepanel/hooks/useSidepanelOrchestration.ts`
  - `packages/extension/src/views/Sidepanel/tabs/NestTab.tsx`
- Unrelated uncommitted local work also exists in:
  - popup create/join flow
  - coop/review/background flow
  - sidepanel coop/draft management
  - shared runtime/contracts/onchain
  - app landing + shared clipboard utilities
- Ignore `.claude/worktrees/*` unless the user explicitly asks about them.

## Validation Baseline

- Prefer the smallest relevant build first.
- Extension-only changes: `cd packages/extension && bun run build`
- Escalate to `bun run validate smoke` when shared/background flows change.
- Known repo baseline issue:
  - `agent-observation-conditions.test.ts` is pre-existing noise and should not be treated as a new regression by default.

## Active Log

### Template

```md
### <task-slug>
- Status: in_progress | blocked | done
- Started: YYYY-MM-DD HH:MM TZ
- Surfaces:
  - path/or/surface
- Regression watchouts:
  - ...
- Changes shipped:
  - ...
- Files touched:
  - ...
- Validation:
  - `command` -> pass/fail
- Follow-up notes:
  - ...
```

### sidepanel-chickens-empty-state
- Status: in_progress
- Started: 2026-03-31 PDT
- Surfaces: sidepanel Chickens tab empty state (Review and Shared segments)
- Expected files:
  - packages/extension/src/global.css (`.empty-state--illustrated` min-height for vertical centering)
  - .plans/features/popup-sidepanel-walkthrough/eval/session-state.md
- Regression watchouts:
  - Preserve compact card rendering and signal/draft unified review model from `chickens-feed-tone-down` and `signal-draft-consolidation`.
  - Preserve roundup-access permission card behavior from `roundup-permission-proactive`.
  - Do not reintroduce layout-shifting notifications.
  - Do not alter non-empty Chickens states (review cards, shared artifacts, orientation summary).
  - Do not alter `.empty-state` base class (used by other elements via color/line-height).
- Prior task overlap:
  - `chickens-feed-tone-down` touched `global.css` and ChickensTab rendering — CSS change must not conflict with calmer card hierarchy.
  - `signal-draft-consolidation` touched ChickensTab and `global.css` — no overlap with empty-state styles.
  - `roundup-permission-proactive` added the Chickens permission card — must coexist when both permission card and empty state show.
- Changes shipped:
  - Added `min-height: calc(100vh - 12rem)` to `.empty-state--illustrated` in `global.css`. This gives the flex container enough height for the existing `justify-content: center` to visually center the chicken icon and text within the sidepanel content area. The `12rem` accounts for the sidepanel shell header, footer tab bar, content padding, sticky subheader, and grid gaps.
  - Both Review ("Round up your loose chickens") and Shared ("Nothing shared yet") empty states are centered, since they share the same `.empty-state--illustrated` class.
  - When the roundup permission card is also visible above the empty state, the combined height naturally scrolls — the empty state content stays centered within its own box rather than being pinned to the top.
- Files touched:
  - packages/extension/src/global.css
  - .plans/features/popup-sidepanel-walkthrough/eval/session-state.md
- Validation:
  - `bun run test -- packages/extension/src/views/Sidepanel/tabs/__tests__/ChickensTab-interactions.test.tsx` -> pass (16 tests)
  - `bun run test -- packages/extension/src/views/Sidepanel/tabs/__tests__/` -> pass (95 tests, 9 files)
  - `cd packages/extension && bun run build` -> pass
  - `bunx @biomejs/biome check packages/extension/src/global.css` -> pass
- Regressions checked:
  - All 16 ChickensTab interaction tests pass including the two existing empty state assertions (review: "Round up your loose chickens", shared: "Nothing shared yet"), orientation grouping, overflow collapse, filter behavior, roundup permission flow, and focus highlighting.
  - All 95 Chickens tab tests across 9 files pass — no regressions from the CSS change.
  - Non-empty Chickens states (review cards, shared artifacts, orientation summary, time groups) are completely unaffected — the `min-height` only applies to `.empty-state--illustrated` which does not render when items are present.
  - The `.empty-state` base class (color/line-height) is untouched; only the `--illustrated` modifier gained `min-height`.
  - Compact card rendering, signal/draft consolidation, push controls, and roundup permission card behavior are all unchanged — no TSX was modified.
- Follow-up notes:
  - The `12rem` in `calc(100vh - 12rem)` is an approximation of the sidepanel chrome height (header ~3rem + footer ~2.75rem + content padding ~1rem + subheader ~3rem + gaps ~2.25rem). If the sidepanel header or footer height changes significantly, this value may need adjustment.
  - The `.empty-state--illustrated` class is currently only used in ChickensTab (sidepanel). If it's ever used in a non-sidepanel context where `100vh` doesn't apply the same way, scope the `min-height` to `.sidepanel-content .empty-state--illustrated` instead.
- Status: done

### popup-sidepanel-regression-sweep
- Status: done
- Started: 2026-03-31 PDT
- Surfaces:
  - popup notifications, roundup, capture review, audio, manual tab capture
  - sidepanel Chickens review surface, agent actions, empty state
  - roundup ingestion/scoring
- Regression watchouts:
  - Treat `agent-observation-conditions.test.ts` as baseline noise unless behavior clearly changed.
  - Preserve unified Chickens review-card contract.
  - Keep notifications non-blocking and non-layout-shifting.
  - Preserve popup responsiveness and roundup/audio/capture behavior.
- Changes shipped:
  - None. No code changes needed — all verification areas passed.
- Files touched:
  - .plans/features/popup-sidepanel-walkthrough/eval/session-state.md (this log only)
- Validation:
  - `bun run test -- packages/extension/src/views/Popup/` -> pass (108 tests, 12 files)
  - `bun run test -- packages/extension/src/views/Sidepanel/` -> pass (435 tests, 48 files)
  - `bun run test -- packages/extension/src/background/` -> 269 pass, 1 known pre-existing fail (agent-observation-conditions.test.ts:71)
  - `bun run test -- packages/extension/src/runtime/` -> pass (246 tests, 29 files)
  - `bun run test -- packages/shared/src/modules/{session,onchain,auth}` -> pass (48 tests, 3 files)
  - `cd packages/extension && bun run build` -> pass (116.9 MB, 15.3s)
- Regressions checked:
  - **Popup notifications**: Toast layer absolutely positioned (popup.css:142-150), outside scroll pane, pointer-events:none. No layout shift. PASS.
  - **Popup roundup concurrency**: Roundup button disabled when in-flight; file/screenshot/audio/tab/note actions use separate `busy` flag and remain enabled. PASS.
  - **Capture review dialog**: "Review before saving" title, "Save as draft" button, draft language throughout. Image preview (max-height 160px), audio preview (<audio controls>), file summary (name+size+type). Dialog capped at 304x400px with overflow scroll. PASS.
  - **Audio permission**: classifyMicrophoneStartFailure() distinguishes denied/promptable/unavailable/unsupported with specific messages. Errors route through toast layer. PASS.
  - **Manual tab capture dedupe**: 12s cooldown window. Accidental repeats suppressed with cooperative "Choose Capture Tab again" message. Second click within window recaptures. PASS.
  - **Roundup ingestion**: Signals scored per-coop with relevanceScore. Stale observations (24h+) filtered separately. Grant-and-roundup flow triggers capture after permission. PASS.
  - **Chickens review surface**: CompactCard renders title, insight, tags (max 2), source, PushControls. Signal/draft consolidation via buildReviewItems() with draftId matching. PASS.
  - **Push controls**: Unified PushControls handles 0 coops (disabled), 1 (button), 2-4 (pills), 5+ (dropdown). Supports both draft publish and signal promote-then-publish. PASS.
  - **Sidepanel agent actions**: 5 handlers wired (run/approve/reject/retry/auto-run) with friendlyAgentError() messages. Real execution results, not generic "done". PASS.
  - **Chickens empty state**: `.empty-state--illustrated` has min-height calc(100vh - 12rem) for centering. Review and Shared segments have distinct empty messages. Roundup permission card renders independently above. PASS.
- Follow-up notes:
  - Known deferred: roundup summary messaging conflates "tabs captured" with "drafts/signals ready" (open follow-up, not a regression).
  - Known deferred: ProactiveSignal lacks favicon field despite Chickens attempting to read one.
  - Known deferred: orphan signal promotion creates workflowStage 'ready' directly (no candidate step).
  - Known deferred: agent-observation-conditions.test.ts:71 pre-existing failure (isRitualReviewDue digest freshness check).
