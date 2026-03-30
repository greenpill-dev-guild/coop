---
feature: agent-autonomy-onchain
title: Agent autonomy and onchain reactivity contracts lane
lane: contracts
agent: codex
status: backlog
source_branch: feature/agent-autonomy-onchain
work_branch: codex/contracts/agent-autonomy-onchain
depends_on:
  - ../spec.md
owned_paths:
  - packages/shared/src/modules/policy
  - packages/shared/src/modules/session
  - packages/shared/src/modules/onchain
done_when:
  - agentActionAuthoritySchema
  - onchainReactionEventSchema
skills:
  - contracts
  - onchain
  - permissions
updated: 2026-03-26
---

# Contracts Lane

- Add or refine onchain event polling and typed action authority wiring.
- Keep session, permit, and policy changes explicit and testable.
