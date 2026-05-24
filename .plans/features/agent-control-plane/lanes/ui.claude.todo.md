---
feature: agent-control-plane
title: Agent Control Plane UI lane
lane: ui
agent: claude
status: backlog
source_branch: feature/agent-control-plane
work_branch: claude/ui/agent-control-plane
depends_on:
  - ../spec.md
  - state.codex.todo.md
owned_paths:
  - packages/extension/src/views/Nest
  - packages/extension/src/views/Roost
  - packages/extension/src/views/shared
skills:
  - ui
  - react
  - accessibility
handoff_out: handoff/qa-codex/agent-control-plane
updated: 2026-05-21
---

# UI Lane

## Objective

Define future advanced/operator surfaces for the agent control plane without changing Coop's
default friendly product surface. This lane should make agent work inspectable and stoppable for
trusted users, while leaving capture, review, and sharing flows approachable for ordinary users.
Live stop/revoke controls should wait for state/runtime affordances; UI work that starts earlier
should be fixture-only.
Keep file ownership tight. If work spills into state/api/contracts surfaces without an explicit
handoff, stop and call it out in `Handoff Notes`.

## Files

- `packages/extension/src/views/Nest`
- `packages/extension/src/views/Roost`
- `packages/extension/src/views/shared`

## Tasks

- [ ] Audit existing advanced/operator surfaces before adding new UI.
- [ ] Design an advanced run-ledger view for goal, actor, tool calls, data sources, policy
      decisions, approval state, cost/spend-like limits, and outcome.
- [ ] Ensure the run-ledger view redacts or omits source bodies, secrets, private prompts, tokens,
      and unredacted retrieved content by default.
- [ ] Design stop/revoke controls that call real runtime/session/policy affordances rather than
      presenting prompt-only stop behavior.
- [ ] Reflect the kill-switch matrix in the UI: runtime cancel, session/permit revoke, policy
      block, spend-like limit, sync/archive pause, and workflow interrupt should be visibly
      distinct when implemented.
- [ ] Keep these controls out of the default simple Coop experience unless a later product decision
      explicitly promotes them.
- [ ] Reuse existing extension components, accessibility patterns, and design tokens.
- [ ] Add or update UI tests where appropriate.
- [ ] Document UX tradeoffs and any ownership spillover.

## Verification

- [ ] Appropriate validation tier was run.
- [ ] Any visual changes were checked in browser.
- [ ] Default/simple Coop flows remain non-operator-facing.
- [ ] UI does not imply a stop/revoke action exists unless the state/runtime lane implemented the
      underlying control.

## Handoff Notes

QA should verify that the operator controls are clear for trusted users but invisible or
non-disruptive for default users. List any human judgment callouts for dependencies,
shared-contract implications, runtime boundary changes, auth/session/policy changes, or ownership
blur introduced by UI work.
