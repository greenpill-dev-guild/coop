---
title: Post-hardening planning reconciliation
date: 2026-04-19
author: Claude (orchestrator)
source_commit: 484078d
follow_up_commit: fedbbd5
validation_evidence:
  - "bun run validate quick: green"
  - "bun run validate smoke: green"
  - "bun run test packages/extension/src/views/Sidepanel/tabs/__tests__/NestAutoresearchSection.test.tsx: 2/2"
  - "bun run test packages/extension/src/views/Sidepanel/__tests__/review-risk.test.tsx: 2/2"
---

# Post-hardening reconciliation — 2026-04-19

Reconciles planning truth for the packs touched by commit `484078d`
(`feat(shared,extension): expand agent runtime controls`) plus the follow-up
autoresearch UI error-handling fix `fedbbd5`. Source-of-truth pass only; no
net-new feature work.

## What the hardening pass actually completed

`484078d` is a broad agent-runtime and shared-policy expansion. Measured against
the five named packs:

| Pack | What landed | Lane impact |
|------|-------------|-------------|
| `agent-judgment-cues` | `review-risk.tsx` + `review-risk.test.tsx`; shared `policy/risk.ts` with `ActionRiskTag`, `collectActionRiskTags`, `requiresExplicitAcknowledgementForItems`; action-bundle propagation | `ui`, `state`, `qa_pass_1` were already `done`. `qa_pass_2` now safe to pick up. |
| `autoresearch` | `NestAutoresearchSection.tsx` scaffold (list, toggle, run-now, collapsible journal); `autoresearch-qa.test.ts` suites in shared storage + extension runtime; runtime+state deps still green | `api`, `state`, `contracts` stay `done`. `ui` still `backlog` — budget slider, quality-floor editor, pagination, explicit loading states not yet shipped. |
| `agent-knowledge-sandbox` | `graph-persistence.ts` (+tests), entity-extraction quality fixtures, provider-promotion tests. Core knowledge-source and graph modules untouched by this commit. | `ui`, `state` stay `done`. |
| `next-gen-model-readiness` | Nothing from the four planned phases (prompt surface / eval pipeline / agent pipeline / dev dispatch). Adjacent runtime maturity (provider contracts, release gates, benchmarks, trace records) landed but is not named in this pack. | No lane flips. |
| `production-readiness` | Expanded runtime + shared-policy tests (~500 new assertions across runtime/agent, shared/policy, shared/storage). Does not close the measured coverage gap, which sits in `packages/app/src/hooks/**` and `packages/extension/src/views/Sidepanel/**` per `eval/qa-report.md`. | `state` stays `blocked`. Release docs stay as-is. |

The follow-up fix `fedbbd5` adds operator-visible error surfacing to the
autoresearch section (aria-live helper, no more silent failures on
load/toggle/run-now) plus a targeted test. It polishes the scaffold; it does
not complete the UI lane.

## What is still open

### Lane-level

- `production-readiness.state` — coverage gate still red. Needs new tests for
  app hooks (`useCapture`, `useReceiverSync`) and Sidepanel hooks. Release
  docs (`current-release-status.md`) already reflect this — do not green.
- `autoresearch.ui` — scaffold in place but missing spec-required controls
  (budget slider, quality-floor editor, journal pagination, explicit loading
  states, "Run Now" progress feedback).
- `agent-knowledge-sandbox.qa_pass_1` — now `ready`. Dispatches Codex QA
  against source CRUD, retrieval, graph persistence, and provenance surfaces
  (`qa/qa-codex.todo.md` check list).
- `autoresearch.qa_pass_1` — now `ready` per deps contract (api+state+
  contracts all `done`). Not dispatching today because `ui` is visibly
  partial; running QA pass 1 now would likely surface UI-adjacent churn
  that is cheaper to re-run after the UI lane closes.
- `agent-judgment-cues.qa_pass_2` — now `ready`. Pure UX review pass over
  Roost and Nest risk badges plus acknowledgement copy.
- `next-gen-model-readiness.{state, api, docs}` — three `ready` lanes, zero
  phase artifacts in the repo. Not a hardening-pass regression; these have
  been queued since 2026-04-02. Unrelated to the current source-of-truth
  scope.

### Status.json flips applied

| Pack | Lane | Before | After |
|------|------|--------|-------|
| `agent-judgment-cues` | `qa_pass_2` | `backlog` | `ready` |
| `agent-knowledge-sandbox` | `qa_pass_1` | `blocked` | `ready` |
| `autoresearch` | `qa_pass_1` | `blocked` | `ready` |

All three satisfy `ready_when_dependencies_met: true` against genuinely
completed upstream lanes. The flips are mechanical; they do not imply the
work has started.

### Docs flips applied

None. `docs/reference/current-release-status.md` already says "blocked" on
the automated staged-launch bar, which matches repo evidence. Release docs
stay no greener than `production-readiness`.

### Artifacts NOT touched (intentionally)

- `.codex/automations/` — ignored per instructions.
- `packages/` source outside the already-committed autoresearch fix.
- Any lane marked `done` in a pack whose upstream evidence I did not fully
  re-verify on this pass.

## Single next runnable worker lane

**`agent-judgment-cues` → `qa_pass_2` (Claude)**

Why this is the conservative pick over the other two newly-`ready` QA lanes:

1. Smallest scope — pure UX review of badges + acknowledgement copy over
   Roost and Nest. All UI surfaces are local to the sidepanel.
2. Dependencies are genuinely closed: `ui`, `state`, and `qa_pass_1` are all
   `done` with real test evidence (`review-risk.test.tsx` green,
   `operator-console.test.tsx` green, `actions-policy-lifecycle.test.ts`
   green, `risk.test.ts` green).
3. Pairs naturally with the hardening pass — the policy/risk infrastructure
   `qa_pass_2` reviews is what `484078d` exercised most directly.
4. Closes a pack rather than spreading effort across `autoresearch.qa_pass_1`
   (UI-adjacent churn risk) or `agent-knowledge-sandbox.qa_pass_1` (valid
   but larger surface, Codex-side).

### Exact worker prompt

Paste verbatim as the handoff to the next agent:

> You are Claude running QA pass 2 on the `agent-judgment-cues` feature pack.
>
> Branch: `handoff/qa-claude/agent-judgment-cues` (cut from `main` at commit
> `fedbbd5` or later).
>
> Scope (read-only unless you find a blocker):
>
> 1. Work from `.plans/features/agent-judgment-cues/qa/qa-claude.todo.md` —
>    every task listed there is in scope; nothing outside it is.
> 2. Treat the current main tree as the code under review. Hardening commit
>    `484078d` landed the risk infrastructure (`policy/risk.ts`,
>    `review-risk.tsx`, `review-risk.test.tsx`, `operator-sections/*`). QA
>    pass 1 (Codex) already confirmed the shared/runtime/background/sidepanel
>    slice is green.
> 3. Validate the four UX questions from the QA pass 2 checklist:
>    - badge density in Roost and Nest stays readable
>    - acknowledgement wording is clear without escalating low-risk chores
>    - no additional high-risk action classes need stronger copy
>    - any remaining human-judgment decisions are called out explicitly
>
> Allowed actions:
>
> - read any source file
> - run `bun run test` on targeted files, especially
>   `packages/extension/src/views/Sidepanel/__tests__/review-risk.test.tsx`
>   and `packages/extension/src/views/Sidepanel/__tests__/operator-console.test.tsx`
> - open the sidepanel in a running dev build to verify badge density and
>   acknowledgement copy visually (project rule: UI changes must be
>   screenshot-verified before reporting work as done — applies to review, too)
> - write findings into `.plans/features/agent-judgment-cues/qa/qa-claude.todo.md`
>   (check the boxes) and create `.plans/features/agent-judgment-cues/eval/qa-report.md`
>   if you find issues worth preserving
>
> Out of scope on this lane:
>
> - editing any source file in `packages/` — if you find a blocker, note it
>   in the QA report and stop. Do not fix.
> - touching any other feature pack (`autoresearch`, `agent-knowledge-sandbox`,
>   `next-gen-model-readiness`, `production-readiness`)
> - changing release docs
>
> Exit condition:
>
> - all four QA pass 2 checklist items either checked green or documented as
>   blockers in the QA report
> - `status.json` for this pack flipped: `qa_pass_2` from `ready` to either
>   `done` (no blockers) or `blocked` (with blocker reference in the QA
>   report)
> - no uncommitted source changes outside `.plans/features/agent-judgment-cues/`

## Constraints honored

- Claude remained orchestrator; no queue-driven implementation without
  reconciliation.
- Release docs (`current-release-status.md`) stayed no greener than
  `production-readiness` (still `blocked`).
- `.codex/automations/` artifacts ignored.
- Autoresearch runtime-error fix preserved as commit `fedbbd5` before any
  metadata flips, so the tree is clean at the point of handoff.
