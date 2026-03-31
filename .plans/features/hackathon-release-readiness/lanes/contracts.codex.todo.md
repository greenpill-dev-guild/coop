---
feature: hackathon-release-readiness
title: Hackathon release archive and live-rails lane
lane: contracts
agent: codex
status: done
source_branch: main
work_branch: codex/contracts/hackathon-release-readiness
depends_on:
  - ../spec.md
owned_paths:
  - packages/extension/src/background/handlers
  - packages/shared/src/modules/archive
  - packages/shared/src/modules/fvm
  - packages/contracts
done_when:
  - archiveVerificationStatus
  - registryDeploymentChecklist
  - liveRailsOperatorGate
tags:
  - Bug
  - Testing
  - Security
  - "Live Rails"
skills:
  - contracts
  - onchain
  - security
  - testing
updated: 2026-03-30
---

# Contracts Lane

## Category

Bug fixing and correctness hardening for archive/Filecoin/live-rails behavior.

## Codex CLI

- Model: `gpt-5.4`
- Reasoning effort: `xhigh`
- Suggested invocation:

```bash
cat .plans/features/hackathon-release-readiness/lanes/contracts.codex.todo.md | codex exec -C /Users/afo/Code/greenpill/coop -m gpt-5.4 -c model_reasoning_effort="xhigh" -
```

## Objective

Verify that the archive/Filecoin path is real, tighten the contract between staged-launch and live
rails, and either update the FVM registry mapping or leave an explicit operator checklist if live
deployment cannot be closed safely in the sprint window.

## Files

- `packages/extension/src/background/handlers/archive.ts`
- `packages/shared/src/modules/archive/`
- `packages/shared/src/modules/fvm/fvm.ts`
- `packages/contracts/` if the registry deployment or script needs direct updates

## Tasks

- [ ] Audit archive upload, receipt, retrieval, anchor, and status-refresh behavior end to end.
- [ ] Update the FVM registry deployment mapping if deployment is completed safely.
- [ ] If registry deployment cannot be finished, write the exact operator checklist and leave the
      product path honestly gated.
- [ ] Review archive-related privacy/security edges and close any narrow, high-confidence issue in
      lane.
- [ ] Add or update targeted tests and validation notes for archive/live-rails behavior.

## Verification

- [ ] targeted archive and shared-module tests
- [ ] `bun run validate:production-readiness`
- [ ] `bun run validate:production-live-readiness` only if the live demo path is explicitly in
      scope

## Handoff Notes

- Be explicit about what is safe for the mock-first release candidate versus what remains
  operator-only.
- If the lane leaves live rails deferred, QA should treat that as an intentional gate, not a hidden
  failure.
