---
feature: ux-surface-clarity
title: UX Surface Clarity QA pass 2
lane: qa
agent: claude
status: done
source_branch: feature/ux-surface-clarity
work_branch: qa/claude/ux-surface-clarity
depends_on:
  - qa-codex.todo.md
skills:
  - qa
  - ui
  - e2e
qa_order: 2
handoff_in: handoff/qa-claude/ux-surface-clarity
updated: 2026-05-06
---

# QA Pass 2

Claude runs the second QA pass after Codex QA is done and `handoff/qa-claude/ux-surface-clarity` exists.

## Focus

- UX regressions
- Interaction gaps
- End-to-end behavior
- Accessibility and visual issues
- Simple-mode product clarity for non-technical community/project members
- Human judgment callouts that remain unresolved after QA pass 1

## Tasks

- [x] Validate the primary flow from the user perspective
- [x] Check simple mode for advanced-language leaks across popup and sidepanel
- [x] Check advanced mode restores builder/operator controls
- [x] Verify that judgment-heavy decisions still read clearly in the UI and operator workflow
- [x] Note findings with file references
- [x] Call out any unresolved human judgment decisions explicitly
- [x] Fix or hand off issues as appropriate

## Verification

- [x] Appropriate E2E or manual validation was run
- [x] Findings are captured in `../eval/qa-report.md`
- [x] Remaining judgment callouts are explicit in `../eval/qa-report.md`

## Notes

- Focused browser QA passed for simple-mode hiding, Nest Settings advanced-mode persistence,
  advanced-mode restoration, reload persistence, and popup simple/advanced behavior.
- QA pass 2 found and fixed a background preference race where repeated default hydration could
  keep the UI reading `uiMode: 'simple'` after the Settings toggle sent an advanced-mode save.
- Existing broad visual snapshots are not a clean release signal yet: the suite has missing
  committed baselines and stale locator assumptions unrelated to this feature.
