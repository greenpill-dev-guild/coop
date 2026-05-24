---
feature: modern-css-web-ui-primitives
title: Modern CSS Web UI Primitives QA pass 2
lane: qa
agent: claude
status: blocked
source_branch: main
work_branch: qa/claude/modern-css-web-ui-primitives
depends_on:
  - qa-codex.todo.md
skills:
  - qa
  - ui
  - accessibility
qa_order: 2
handoff_in: handoff/qa-claude/modern-css-web-ui-primitives
updated: 2026-05-24
---

# QA Pass 2

Claude runs the second QA pass only after Codex QA is done and the Claude QA handoff branch exists.

## Focus

- UX regressions
- Accessibility preference behavior
- Popup, sidepanel, app, and shared visual consistency
- Dialog/sheet/tooltip/scroll interaction quality
- Human judgment callouts that remain unresolved after QA pass 1

## Tasks

- [ ] Validate representative UI surfaces from the user perspective.
- [ ] Verify large text, reduced motion, focus, and fallback behavior for any changed primitive.
- [ ] Note findings with file references.
- [ ] Call out any unresolved human judgment decisions explicitly.

## Verification

- [ ] Appropriate browser, extension, or manual validation was run.
- [ ] Findings are captured in `../eval/qa-report.md`.
- [ ] Remaining judgment callouts are explicit in `../eval/qa-report.md`.
