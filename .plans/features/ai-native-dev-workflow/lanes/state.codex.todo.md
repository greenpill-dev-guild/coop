---
feature: ai-native-dev-workflow
title: AI-Native Developer Workflow state lane
lane: state
agent: codex
status: done
source_branch: feature/ai-native-dev-workflow
work_branch: codex/state/ai-native-dev-workflow
depends_on:
  - ../spec.md
owned_paths:
  - .plans/features/ai-native-dev-workflow
done_when:
  - agent-run-ledger-template
  - workflow-scorecard-template
  - closeout-gate-evidence
skills:
  - plan
  - review
updated: 2026-05-24
---

# State Lane

## Objective

Own the evidence artifacts for Coop's AI-native workflow upgrade.

## Tasks

- [x] Fill one Agent Run Ledger entry for an active feature.
- [x] Fill one Workflow Scorecard baseline for a recent feature.
- [x] Record verification cost and repeated failure patterns.
- [x] Keep all evidence inside this hub.

## Verification

- [x] `bun run plans:validate`
- [x] `bun run validate quick` not required for this pass because only `.plans/features/ai-native-dev-workflow` changed.
