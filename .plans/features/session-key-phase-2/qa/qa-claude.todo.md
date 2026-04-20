---
feature: session-key-phase-2
title: Session key phase 2 QA pass 2
lane: qa
agent: claude
status: blocked
source_branch: feature/agent-autonomy-onchain
work_branch: qa/claude/session-key-phase-2
depends_on:
  - ./qa-codex.todo.md
qa_order: 2
handoff_in: handoff/qa-claude/session-key-phase-2
updated: 2026-04-09
---

# QA Pass 2 — Claude

## Full Validation

- [ ] `bun format && bun lint && bun run test && bun build` — all clean

## Manual Verification

- [ ] Issue session capability with `green-goods-submit-work-approval` in operator console
- [ ] Verify PermissionId hash changes when scope includes new actions
- [ ] Verify old capabilities (4-action scope) still validate and execute
- [ ] Verify structured `SessionCapabilityErrorCode` in rejection responses
- [ ] Verify auto-rotation log entries appear after threshold execution
- [ ] Verify auto-rotation creates new capability with same scope

## Cross-Repo Checks (Phase 3)

- [ ] GG `HatPermissionMapping` type imported cleanly in Coop
- [ ] Operator hat maps to all 7 session-executor actions
- [ ] Gardener hat maps to subset (garden sync + domains only)
- [ ] Issuance with scope exceeding hat → clear rejection message

## Yield Janitor Checks (Phase 4)

- [ ] `green-goods-yield-janitor` skill.json validates against skill schema
- [ ] `SKILL.md` has required frontmatter fields
- [ ] Yield executor handles harvest failure gracefully (does not proceed to split)
- [ ] Vault targetAllowlist enforced (garden A's vault cannot harvest garden B's vault)

## Cockpit Checks (Phase 5)

- [ ] CommandPalette shows "Agent Actions" category when operator role
- [ ] CommandPalette hides "Agent Actions" when non-operator
- [ ] FloatingToolbar notification dot appears with pending agent actions
- [ ] TopContextBar shows agent status (active sessions count, quality trend)

## Code Quality

- [ ] No `console.log` in production paths (use session capability log entries)
- [ ] No hardcoded addresses (use deployment artifacts)
- [ ] All new exports added to module index files
- [ ] Test factories follow existing `make*` naming convention
- [ ] No duplication between test factories for old and new action classes
