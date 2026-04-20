---
feature: hackathon-release-readiness
title: Hackathon release sync and pairing reliability lane
lane: api
agent: codex
status: done
source_branch: main
work_branch: codex/api/hackathon-release-readiness
depends_on:
  - ../spec.md
owned_paths:
  - packages/extension/src/views/Sidepanel
  - packages/extension/src/background/handlers
  - packages/extension/src/runtime
  - packages/shared/src/modules/receiver
  - packages/api
done_when:
  - syncHealthHint
  - pairDeviceStatusNote
  - inviteFlowRecovery
tags:
  - Bug
  - Testing
skills:
  - testing
  - debug
  - storage
  - sync
updated: 2026-03-30
---

# API Lane

## Category

Bug fixing and reliability proof for cross-device and cross-browser behavior.

## Codex CLI

- Model: `gpt-5.4`
- Reasoning effort: `high`
- Suggested invocation:

```bash
cat .plans/features/hackathon-release-readiness/lanes/api.codex.todo.md | codex exec -C /Users/afo/Code/greenpill/coop -m gpt-5.4 -c model_reasoning_effort="high" -
```

## Objective

Treat sync, receiver, pair-device, and invite flows as a reliability lane. The goal is to prove the
existing architecture, close any narrow gaps, and improve the observable health/error states.

## Files

- `packages/extension/src/views/Sidepanel/hooks/useSyncBindings.ts`
- `packages/extension/src/background/handlers/receiver.ts`
- `packages/extension/src/runtime/receiver.ts`
- `packages/shared/src/modules/receiver/pairing.ts`
- `packages/shared/src/modules/receiver/sync.ts`
- `packages/shared/src/modules/receiver/relay.ts`
- `packages/extension/src/views/Sidepanel/hooks/useSidepanelInvites.ts`
- `packages/extension/src/views/Sidepanel/tabs/NestInviteSection.tsx`
- `packages/api/` only if a real signaling or websocket issue is confirmed

## Tasks

- [ ] Audit browser-to-browser sync over Fly and direct peer paths and repair any concrete blocker.
- [ ] Review pair-device behavior and close the most important functional gaps.
- [ ] Verify invite creation, redemption, and member/trusted paths are reliable and legible.
- [ ] Improve sync health/error signaling only where the underlying behavior needs clearer runtime
      reporting.
- [ ] Add or update focused tests for sync, pairing, and invite regressions.

## Verification

- [ ] `bun run validate:receiver-slice`
- [ ] `bun run validate:sync-hardening`
- [ ] `bun run test:e2e:sync`
- [ ] `bun run test:e2e:receiver-sync`

## Handoff Notes

- Surface any remaining manual-only checks for the final QA pass.
- Do not expand into UI redesign; keep copy or presentation changes minimal unless required for
  error-state clarity.
