# Context For Hackathon Release Readiness

## Existing References

- `docs/reference/current-release-status.md`
- `docs/reference/testing-and-validation.md`
- `docs/reference/demo-and-deploy-runbook.md`
- `docs/reference/extension-install-and-distribution.md`
- `.plans/features/production-readiness/spec.md`
- `.plans/features/filecoin-cold-storage/spec.md`

## Relevant Codepaths

### Setup, Passkey, And Green Goods

- `packages/extension/src/views/shared/useCoopActions.ts`
- `packages/extension/src/views/Popup/PopupCreateCoopScreen.tsx`
- `packages/extension/src/views/Popup/PopupJoinCoopScreen.tsx`
- `packages/extension/src/views/Sidepanel/hooks/useCoopForm.ts`
- `packages/extension/src/views/Sidepanel/setup-insights.ts`
- `packages/extension/src/views/Sidepanel/tabs/NestTab.tsx`

### Sync, Pairing, Receiver, And Invites

- `packages/extension/src/views/Sidepanel/hooks/useSyncBindings.ts`
- `packages/extension/src/background/handlers/receiver.ts`
- `packages/extension/src/runtime/receiver.ts`
- `packages/shared/src/modules/receiver/pairing.ts`
- `packages/shared/src/modules/receiver/sync.ts`
- `packages/shared/src/modules/receiver/relay.ts`
- `packages/extension/src/views/Sidepanel/hooks/useSidepanelInvites.ts`
- `packages/extension/src/views/Sidepanel/tabs/NestInviteSection.tsx`

### Archive, Filecoin, And FVM

- `packages/extension/src/background/handlers/archive.ts`
- `packages/shared/src/modules/archive/`
- `packages/shared/src/modules/fvm/fvm.ts`
- `packages/contracts/`

### Review And Polish Surfaces

- `packages/extension/src/views/Sidepanel/tabs/ChickensTab.tsx`
- `packages/extension/src/views/Sidepanel/cards.tsx`
- `packages/extension/src/views/Sidepanel/tabs/RoostTab.tsx`
- `packages/extension/src/views/Popup/PopupHomeScreen.tsx`
- `packages/extension/src/runtime/tab-capture.ts`
- `packages/shared/src/modules/coop/pipeline.ts`
- `packages/shared/src/modules/coop/review.ts`

### Landing, Docs, And Story

- `packages/app/src/views/Landing/index.tsx`
- `packages/app/src/styles.css`
- `docs/builder/getting-started.md`
- `docs/builder/extension.md`
- `docs/reference/extension-install-and-distribution.md`
- `docs/reference/demo-and-deploy-runbook.md`
- `docs/community/pricing.md`
- `docs/community/road-ahead.md`
- `/Users/afo/Code/greenpill/green-goods/packages/client`

## Constraints

- The sprint is deadline-driven; prefer confident closure over broad exploration.
- Mock-first release confidence is the minimum bar. Live-rails validation is a separate explicit
  decision.
- Codex effort for this sprint should use `high` by default and `xhigh` only for the highest-risk
  lanes; treat `medium` as effectively out of scope.
- The root `.env.local` remains the only environment source.
- The human operator will keep the dev environment running in a separate terminal while Claude
  executes the plan.
- No lane should reopen a different lane's files without an explicit handoff.
- Create/join, sync, archive, and install/demo paths should be validated before optional delight
  work.
- Strategy/docs should remain product-first while drawing supporting rationale from the Durgadas
  Coordination Structural Integrity Suite: https://github.com/durgadasji/standards

## Current Known Risks

- Popup create flow currently auto-enables Green Goods while the sidepanel does not.
- Passkey rationale is too implicit in first-run create/join flows.
- Sync and receiver flows appear implemented but still need browser-to-browser proof.
- Archive/Filecoin is substantial, but FVM registry deployment mapping is not filled in.
- Preview metadata exists in capture but is not consistently surfaced in review UI.
- Landing/docs are content-rich but do not route builders to installation quickly enough.

## Claude Orchestration Notes

- Claude should operate as the conductor, not as a parallel editor of Codex-owned files.
- Use `bun run plans queue --agent codex --json` to pull ready Codex lanes and `bun run plans queue --agent claude --json` or `--lane docs` for Claude lanes.
- Preferred Codex CLI commands:
  - `cat .plans/features/hackathon-release-readiness/lanes/state.codex.todo.md | codex exec -C /Users/afo/Code/greenpill/coop -m gpt-5.4 -c model_reasoning_effort="high" -`
  - `cat .plans/features/hackathon-release-readiness/lanes/api.codex.todo.md | codex exec -C /Users/afo/Code/greenpill/coop -m gpt-5.4 -c model_reasoning_effort="high" -`
  - `cat .plans/features/hackathon-release-readiness/lanes/contracts.codex.todo.md | codex exec -C /Users/afo/Code/greenpill/coop -m gpt-5.4 -c model_reasoning_effort="xhigh" -`
  - `cat .plans/features/hackathon-release-readiness/qa/qa-codex.todo.md | codex exec -C /Users/afo/Code/greenpill/coop -m gpt-5.4 -c model_reasoning_effort="xhigh" -`
- Do not schedule `medium` effort Codex runs for this pack.

## Failure Modes To Avoid

- Global queue drift:
  - The repo has other ready plans.
  - Claude must filter by `feature == hackathon-release-readiness` before starting work.
- Shared-checkout collisions:
  - Parallel lanes must not run in one mutable checkout.
  - Use each lane's `work_branch` with separate worktrees or equivalent isolated workspaces.
- Missing operator checkpoints:
  - Claude must not assume that automated validation alone is enough to move between major phases.
  - The human operator should validate the running dev environment at phase boundaries before
    Claude continues.
- Premature handoff:
  - `ui.claude` must not begin while `state.codex` and `api.codex` are still changing shared
    assumptions.
  - `qa-codex` and `qa-claude` must not start early just to keep agents busy.
- Hidden findings:
  - Important validation results must be written into `eval/qa-report.md` and lane files, not left
    as ephemeral chat context.
- Codex quota or billing failures:
  - If Codex reports quota exhaustion, billing failure, auth failure, or rate limiting, Claude must
    stop launching Codex work and surface the blocker immediately.
  - Claude may continue only with already-assigned Claude-owned work that does not trigger more
    Codex usage.

## Notes For Agents

- Claude should focus on:
  - docs, landing, demo story, and non-overlapping UI polish
  - a clear manual UX/demo pass after technical QA
  - pausing for human validation after Phase 1, after Phase 2, and before any final release call
- Codex should focus on:
  - setup-flow bugs
  - sync/receiver/invite reliability
  - archive/FVM/live-rails correctness
  - technical QA and privacy/security hardening
- Shared assumptions:
  - the immediate target is a trustworthy release candidate, not an exhaustive product redesign
  - docs/story work should not block bug fixes, but the install path should be treated as release
    relevant
