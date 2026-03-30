---
feature: ui-action-coverage-hardening
title: UI action coverage hardening state lane
lane: state
agent: codex
status: ready
source_branch: refactor/ui-action-coverage-hardening
work_branch: codex/state/ui-action-coverage-hardening
depends_on:
  - ../spec.md
owned_paths:
  - packages/extension/src/views/Popup
  - packages/extension/src/views/shared
  - packages/shared/src/modules/coop
done_when:
  - popup-roundup-action-coverage
  - persisted-action-validation-regression
skills:
  - shared
  - state-logic
  - testing
updated: 2026-03-26
---

# State Lane

- Strengthen persistence, handler, sync, and validation coverage that underpins the browser flows.
