---
feature: agent-control-plane
title: Agent Control Plane state lane
lane: state
agent: codex
status: backlog
source_branch: feature/agent-control-plane
work_branch: codex/state/agent-control-plane
depends_on:
  - ../spec.md
owned_paths:
  - packages/shared/src/modules/agent
  - packages/shared/src/modules/policy
  - packages/shared/src/modules/session
  - packages/shared/src/modules/permit
  - packages/shared/src/modules/storage
  - packages/shared/src/modules/sync-core
  - packages/extension/src/runtime/agent
  - packages/extension/src/background/handlers
done_when:
  - agentRunLedger
  - agentToolDecisionRecord
  - stopAgentRun
  - revokeAgentDelegation
  - runtimeDurabilityProbe
skills:
  - state-logic
  - shared
  - storage
updated: 2026-05-21
---

# State Lane

## Objective

Define the future shared/runtime primitives for Coop's agent control plane. This lane should own
the operator run ledger, policy/tool decision records, cancellation and revocation semantics, and
proof that browser-native agent work can pause, resume, retry, recover, or wake later.

`done_when` should use concrete, searchable evidence strings that will exist under `owned_paths`
when the lane is truly complete.
Keep changes inside `owned_paths` where possible. If work spills beyond them, explain why in
`Handoff Notes`.

## Files

- `packages/shared/src/modules/agent`
- `packages/shared/src/modules/policy`
- `packages/shared/src/modules/session`
- `packages/shared/src/modules/permit`
- `packages/shared/src/modules/storage`
- `packages/shared/src/modules/sync-core`
- `packages/extension/src/runtime/agent`
- `packages/extension/src/background/handlers`

## Tasks

- [ ] Define the minimal run-ledger record for goal, actor/principal, status, policy decisions,
      data sources, tool calls, approval state, cost/spend-like limits, and outcome.
- [ ] Record both `requestedBy` and `actingScope` for every run; default privileged actions to an
      explicit delegated session or coop-authorized capability.
- [ ] Keep ledger entries metadata-first and local-only by default, with no raw source bodies,
      secrets, private prompts, tokens, or unredacted retrieved content in shared/exported records.
- [ ] Define policy/tool decision records that explain allowed, blocked, pending-approval, and
      revoked actions without relying on model text alone.
- [ ] Define stop semantics across runtime cancellation, session/permit revocation, policy blocks,
      spend-like limits, sync/archive pauses, and workflow interrupts.
- [ ] Add browser-runtime durability proof for pause/resume/retry/recover/wake-later behavior.
- [ ] Keep existing scoped spending and session-key implementation details in their current hubs.
- [ ] Add targeted unit/integration coverage for any persisted state or message-contract changes.
- [ ] Call out migrations, auth/session/permit/policy changes, public contracts, and runtime
      boundary changes in handoff notes.

## Verification

- [ ] Appropriate validation tier was run.
- [ ] Changed state paths are covered by tests.
- [ ] Runtime durability proof covers at least one interrupted/recovered browser-agent run.
- [ ] Kill-switch behavior is tested at more than the prompt/model layer.
- [ ] Scenario coverage includes runaway retry loop, revoked session/permit, unauthorized source,
      offline recovery, stale tool decision, spend-limit hit, and user/operator stop during an
      active run.

## Handoff Notes

QA should target confusing authority boundaries: user vs coop vs application vs delegated session.
Every implementation pass must list human judgment callouts for dependencies, migrations/persisted
state, auth/session/permit/policy changes, public contracts, runtime/toolchain boundaries, and any
ownership blur with `agent-evolution` or `session-key-phase-2`.
