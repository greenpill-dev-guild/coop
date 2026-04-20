---
feature: agent-judgment-cues
title: Passive judgment cues state lane
lane: state
agent: codex
status: done
source_branch: main
work_branch: codex/state/agent-judgment-cues
depends_on:
  - ../spec.md
owned_paths:
  - packages/shared/src/contracts/schema-agent.ts
  - packages/shared/src/contracts/schema-policy.ts
  - packages/shared/src/modules/agent
  - packages/shared/src/modules/policy
  - packages/extension/src/runtime/agent
  - packages/extension/src/background/handlers/actions.ts
done_when:
  - collectActionRiskTags(
  - requiresExplicitAcknowledgementForItems(
  - riskTags: riskState.riskTags
updated: 2026-04-18
---

# State Lane

- Added deterministic `ActionRiskTag` metadata and shared classifier helpers.
- Propagated risk tags into agent proposals and queued action bundles.
- Wired runtime proposal creation to use resolved onchain mode for live-risk tagging.
- Added targeted shared/runtime/background tests to prove propagation and formatting behavior.

## Handoff Notes

Human judgment callouts:

- Public contract change: agent proposals and queued bundles now persist `riskTags` and
  `requiresExplicitAcknowledgement`; downstream consumers need to treat those fields as part of the
  review contract.
- Product judgment remains in the threshold, not the mechanics: only `live`, `permission`, and
  `destructive` tags require explicit acknowledgement, while `publish`, `sync`, and `archive`
  remain passive cues.
- No dependency, migration, or toolchain boundary changes were introduced in this lane.
