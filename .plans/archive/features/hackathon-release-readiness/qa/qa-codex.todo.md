---
feature: hackathon-release-readiness
title: Hackathon release QA pass 1
lane: qa
agent: codex
status: done
source_branch: main
work_branch: qa/codex/hackathon-release-readiness
depends_on:
  - ../lanes/state.codex.todo.md
  - ../lanes/api.codex.todo.md
  - ../lanes/contracts.codex.todo.md
  - ../lanes/ui.claude.todo.md
tags:
  - Testing
  - Security
  - "Live Rails"
skills:
  - qa
  - testing
  - debug
  - security
qa_order: 1
handoff_in: handoff/qa-codex/hackathon-release-readiness
handoff_out: handoff/qa-claude/hackathon-release-readiness
updated: 2026-03-30
---

# QA Pass 1

## Category

Testing and release gating.

## Codex CLI

- Model: `gpt-5.4`
- Reasoning effort: `high`
- Suggested invocation:

```bash
cat .plans/features/hackathon-release-readiness/qa/qa-codex.todo.md | codex exec -C /Users/afo/Code/greenpill/coop -m gpt-5.4 -c model_reasoning_effort="high" -
```

## Focus

- release-gate validation
- privacy/security review
- manual residual-risk capture
- a binary recommendation on whether Claude should proceed to final UX/demo QA

## Tasks

- [ ] Run targeted validation in a sensible order:
      `bun run validate:popup-slice`,
      `bun run validate:receiver-slice`,
      `bun run validate:sync-hardening`,
      `bun run validate:store-readiness`,
      `bun run validate:production-readiness`.
- [ ] Run `bun run validate:production-live-readiness` only if the human decision is that the live
      demo path must be green.
- [ ] Confirm the manual real-Chrome popup `Capture Tab` and `Screenshot` checks called out in
      `docs/reference/current-release-status.md`.
- [ ] Perform a targeted privacy/security sweep across passkey, sync, receiver, invite, and
      archive flows.
- [ ] Record commands, findings, and residual risks in `../eval/qa-report.md`.
- [ ] Create `handoff/qa-claude/hackathon-release-readiness` only if the result is honest enough
      for final product QA.

## Verification

- [ ] Validation commands and outcomes are logged
- [ ] Any intentional live-rails deferral is explicit
- [ ] The release recommendation is binary: ready for Claude QA or still blocked
