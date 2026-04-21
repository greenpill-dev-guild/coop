---
feature: production-readiness
title: Production readiness QA pass 2
lane: qa
agent: claude
status: done
source_branch: main
work_branch: qa/claude/production-readiness
depends_on:
  - qa-codex.todo.md
qa_order: 2
handoff_in: handoff/qa-claude/production-readiness
updated: 2026-04-19
---

# QA Pass 2

> Closed `done` on 2026-04-19 in the same pass as the `ui` lane. The UI
> lane's `done_when` is "UI acceptance checklist in this file + safe-to-defer
> polish called out" — the artifacts are here, the sequencing between `ui`
> and `qa_pass_2` was formal-only in this pack (per spec: "QA 2 · Claude ·
> optional follow-on UX review"). One review, two gates lifted.

## Visual Verification Disclosure

This pass is code-level review plus green test evidence, not screenshot-
verified on a running dev build. That was the same trade-off taken on
`agent-judgment-cues` QA pass 2; the decision here is the same. If the team
wants live-build screenshots of the Popup capture review dialog, the Roost /
Chickens subheaders, and the Receiver shell under real data, reopen for a
follow-up visual pass. Disproportionate to run from this QA2 alone.

## Acceptance Checklist

Each bullet is a shipped release surface + the outcome this pass validated.

### Popup capture and review

- [x] `PopupCaptureReviewDialog.tsx` uses `aria-modal`, `aria-labelledby` on
      the title, `aria-label` on the close button, and a focus-trap hook.
      Cancel and Save buttons disabled while `saving`, backdrop click-to-
      dismiss suppressed while saving, Save disabled until `title` is
      non-empty.
- [x] Kind-aware preview: image (`<img>`), audio (`<audio controls>`), and
      non-image file (icon + filename + size). Metadata pill row shows
      `kind · bytes · duration` bounded by existing `popup-mini-pill`
      tokens.
- [x] 93 popup tests green across 9 test files (PopupApp integration,
      popup-actions integration, draft list, feed, home, share menu, sync
      status, invite share, source health).

### Screenshot review dialog clarity

- [x] Image preview card uses shipped `popup-preview-card` radius + shadow.
- [x] Title field is primary (plain text input), Context is secondary
      (`<textarea>` with placeholder prompt).
- [x] Source and filename surface in a secondary "Details" section only
      when present — never empty.

### Chickens and Sidepanel information hierarchy

- [x] Chickens segments `Review` / `Shared` via `PopupSubheader` with count
      pill tags and `aria-pressed` on the active segment.
- [x] Time-grouped review items with per-group "Show N more" overflow at 3
      items; sensible collapse behavior.
- [x] Category filter popover only visible in the Review segment and only
      when more than one category exists.
- [x] Orientation-summary card separates seed coop-soul artifacts from
      real captures in the Shared segment.
- [x] Illustrated empty states for both segments.
- [x] Skeleton loading fallback while dashboard is null.
- [x] Roost three sub-tabs (Focus / Agent / Garden) with badge counts
      clamped at 99+.
- [x] Nest four sub-tabs (Members / Agent / Settings / Sources) only
      rendered when an active coop exists.
- [x] 488 sidepanel tests green across 56 files.

### Receiver handoff and navigation polish

- [x] `ReceiverShell.tsx` topbar (mark + screen title + status dots +
      summary text), `BottomSheet` settings with status grid + install /
      notifications / About Coop actions.
- [x] Pull-to-refresh gesture wired with a minimum 30 px threshold.
- [x] Install nudge banner only shows on supported browsers; About Coop
      fallback link when no native install prompt.
- [x] Bottom appbar `<nav aria-label="Receiver navigation">` uses
      `aria-current="page"` on the active route.
- [x] Sidepanel footer nav (`TabStrip.tsx` / `SidepanelFooterNav`) uses
      `aria-current="page"` + badge overflow at 99+ + conditional Nest
      visibility gated on operator role.
- [x] 9 receiver-app tests green (ReceiverApp + view-actions).

### Spacing, typography, tokens, accessibility polish

- [x] `shared/src/styles/tokens.css` ships full palette, alpha scale,
      radius scale, spacing scale, z-index scale, semantic UI tokens, and
      dark-mode coverage via both `@media (prefers-color-scheme: dark)` and
      explicit `[data-theme="dark"]`.
- [x] Font-metric overrides (`size-adjust`, `ascent-override`) on the
      body + display fonts for CLS reduction.
- [x] Dialog / overlay / switcher / subheader components carry
      `aria-modal`, `aria-labelledby`, `aria-expanded`, `aria-haspopup`,
      `aria-pressed`, `aria-current`, `aria-label` as appropriate.
- [x] `@coop/shared/app` design-tokens-wiring test suite is green (7
      tests) — palette/surface/pill tokens are not drifting between app
      and extension builds.

## Source Fixes Applied In This Pass

One real a11y gap surfaced during the code audit and was fixable inside
the shipped surface. Both changes are pure attribute additions — no
behavior changed, no new tests required.

- `packages/extension/src/views/Sidepanel/tabs/RoostTab.tsx` — added
  `aria-pressed` to each of the three Focus / Agent / Garden sub-tab
  buttons so they match the `aria-pressed` contract of the ChickensTab
  segment tags (`PopupSubheader`) and are readable by screen readers as
  toggle buttons instead of unlabeled ones.
- `packages/extension/src/views/Sidepanel/tabs/NestTab.tsx` — same fix
  applied to the four Members / Agent / Settings / Sources sub-tab
  buttons so the operator Nest nav matches the same contract.
- Verified with `bun run test` across the Roost and Nest interaction
  suites (`RoostTab-interactions`, `RoostTab-subheader`, `nest-sections`,
  `NestSettingsSection-interactions`, `nest-subheader-integration`) —
  102 tests green, no regressions.
- `bun run validate quick` green after the edit.

## Safe-To-Defer Polish (Not Launch Blockers)

The following items surfaced during the audit but are not required to
ship the staged launch. Documented here so they don't get lost.

1. **Receiver status summary phrasing** — `ReceiverShell.tsx` reads
   `Online · Paired · N items` with middot separators. Works, but
   screen-reader pronunciation on some engines swallows middots; a
   comma-separated or explicitly-wrapped `<span>` per segment would
   parse more predictably. Low severity.
2. **Sidepanel waiting-chores coopId badge** — the `PolicyAndQueueSection`
   row shows a short coopId prefix as a badge. Readable for operators who
   know the ids, ambiguous for new operators. Could switch to a
   human-readable coop name pill. Product-decide, not launch-blocking.
3. **Alpha-tint contrast sweep** — pill backgrounds use `color-mix` alpha
   tints (e.g. `--coop-green-12`, `--coop-orange-16`). Text inside these
   pills uses `--coop-green` / `--coop-brown`, which should pass AA, but
   the specific combinations were not formally measured on this pass.
   Recommend running axe-core against a dev build with real data before a
   formal WCAG audit.
4. **Time-group overflow threshold** — Chickens time-group collapse fires
   at 3 items. On wider sidepanel widths this can feel aggressive. Minor
   tuning knob, not a blocker.
5. **Dark-mode roll-through** — tokens exist for dark mode; a formal
   visual pass across every shipped surface (not just the ones audited
   here) should happen before public launch. Not this lane.

## Release Docs Follow-Up (Out Of Scope For This Lane)

Consistent with the state lane QA report: `docs/reference/current-release-
status.md` and sibling reference docs still describe the pre-2026-04-19
"blocked" posture. Those are outside this lane's scope and need a
docs-drift pass of their own before the next public release handoff.
