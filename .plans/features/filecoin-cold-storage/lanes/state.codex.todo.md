---
feature: filecoin-cold-storage
title: Filecoin verification and retrieval lane
lane: state
agent: codex
status: backlog
source_branch: feature/filecoin-cold-storage
work_branch: codex/state/filecoin-cold-storage
depends_on:
  - ../spec.md
owned_paths:
  - packages/shared/src/modules/archive
  - packages/extension/src/runtime
  - packages/extension/src/views/Sidepanel
done_when:
  - verifyArchivedBundle(
  - publicVerificationRoute
skills:
  - shared
  - archive
  - storage
updated: 2026-03-26
---

# State Lane

- Treat this as a narrow follow-on slice, not a restart of the original Filecoin plan.
- Prioritize one concrete gap at a time:
  - verified bundle retrieval and clearer proof/error surfacing
  - receipt data shaping needed for a public verification route
  - shareable verification-link plumbing if a real route exists
- Avoid redoing already-shipped work:
  - Storacha setup wizard
  - existing receipt lifecycle badges and deal display
  - basic refresh / FVM registration hooks
