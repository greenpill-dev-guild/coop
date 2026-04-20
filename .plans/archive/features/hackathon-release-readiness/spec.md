# Hackathon Release Readiness

**Feature**: `hackathon-release-readiness`
**Status**: Active
**Source Branch**: `main`
**Created**: `2026-03-30`
**Last Updated**: `2026-03-30`

## Summary

Ship Coop to a credible hackathon release bar in roughly 32 hours by splitting the remaining work
into non-overlapping lanes: fix the known setup and reliability bugs first, run UI polish only
after logic contracts settle, improve builder/download and demo docs in parallel, then finish with
sequential QA and a clear release decision. The refined release story is product-first,
standards-backed, with fast-scan Chickens cards and a lighter popup-home yard.

## Why Now

- The product is close enough that the highest risk is coordination failure, not missing core
  architecture.
- One confirmed product bug already exists in the popup create flow: Green Goods is auto-enabled
  there while the sidepanel already treats it as optional.
- Sync, receiver, invites, and archive flows already exist, so the remaining work is mostly
  consistency, hardening, polish, and proof.
- The hackathon deadline leaves little room for overlapping edits or ambiguous ownership.

## Scope

### In Scope

- create/join flow consistency, including optional Green Goods setup and clear passkey rationale
- sync, receiver pairing, invite management, and browser-to-browser proof over Fly and direct peer
- archive/Filecoin/FVM registry readiness for the demo path
- Chickens, Roost, and popup-home polish once the data and state contracts are stable
- landing page and docs improvements so builders can install the extension quickly
- a demo storyboard and a concise forward-looking narrative for release/demo support
- final privacy/security review and release validation

### Out Of Scope

- broad redesigns outside the listed release surfaces
- deep protocol refactors or new infrastructure not required for the hackathon release
- turning operator-only live rails into a public-safe production architecture in this sprint
- a full monetization strategy deck beyond a concise narrative outline

## Work Classification

### Bugs

- popup create flow hard-wires Green Goods creation instead of keeping it optional
- create/join flows do not explain passkeys clearly enough for user trust
- sync, receiver pairing, invite management, and archive need proof and hardening, not greenfield
  implementation
- preview image/favicon/social metadata is captured but not consistently plumbed into the
  synthesis/review UI

### Polish

- Chickens needs a final clarity pass around synthesis and review flow
- Roost needs a stronger action/explore hierarchy
- the popup home chicken can become more playful if it stays light and non-blocking
- privacy and trust language should feel explicit and calm across the product surfaces

### Documentation

- landing and docs should route builders directly to install/download steps
- the demo flow needs a public-facing storyboard, not only an internal runbook
- the pitch story needs a concise outline for tenets, monetization, and future features
- strategy/docs should stay Coop-native while citing the Durgadas Coordination Structural Integrity
  Suite as the deeper supporting frame

### Testing

- targeted release slices must pass before UI polish is treated as done
- browser-to-browser sync, pair-device, popup capture/screenshot, and archive demo paths need
  explicit validation
- mock-first release readiness is the minimum bar; live-rails validation is a separate opt-in gate

## Tags

- `Bug`: setup-flow defects, reliability gaps, and data-plumbing issues that must be corrected
- `Polish`: UX clarity, interaction quality, visual hierarchy, and lightweight delight work
- `Documentation`: landing, builder-install, docs routing, and explanatory product copy
- `Testing`: automated validation, manual checks, and release-gate proof
- `Security`: privacy review, leak prevention, and trust-boundary hardening
- `Demo`: demo storyboard, rehearsal quality, and presentable end-to-end flow
- `Strategy`: tenets, monetization, and future-features narrative
- `Live Rails`: archive/onchain/session behavior that is only valid when live paths are explicitly
  in scope

## Phase Plan

### Phase 1: Parallel Blocking Work

- `state.codex`: setup-flow bugs, passkey rationale in create/join, preview metadata plumbing
- `api.codex`: sync, pair-device, invites, and receiver reliability
- `contracts.codex`: archive/Filecoin/FVM registry and live-rails contract review
- `docs.claude`: landing/docs/install path, demo outline, and story-support docs

### Phase 2: Parallel Polish After Contracts Settle

- `ui.claude` starts after `state.codex` and `api.codex` land
- focus on Chickens, Roost, popup-home delight, and trust/presentation polish only
- before Phase 2 begins, Claude should pause for explicit human validation on the Phase 1 work in
  the running dev environment

### Phase 3: Sequential QA

- `qa-codex` runs first for technical validation, privacy/security review, and release gating
- `qa-claude` runs second for manual UX, demo rehearsal, docs/install sanity, and polish triage
- before Phase 3 begins, Claude should pause for explicit human validation on the polished
  implementation in the running dev environment

### Phase 4: Stretch Narrative Work

- finish tenets, monetization, and future-features framing only if release-critical work is green
- before any final release recommendation or ship call, Claude should pause for explicit human
  validation and release approval

## Technical Notes

- Primary packages: `packages/extension`, `packages/shared`, `packages/app`, `packages/api`
- Shared logic should continue to live in `@coop/shared`; extension/app changes should stay thin
- Root `.env.local` remains the only env source
- The human operator will run the dev environment in a separate terminal. Claude should treat that
  running environment as shared execution context rather than trying to own a long-lived dev
  session itself unless explicitly asked.
- Preferred local dev posture while the plan is being executed:
  - `bun dev` when the full stack is needed
  - or `bun dev:app`, `bun dev:api`, and `bun dev:extension` when narrower iteration is cleaner
- Release target is mock-first unless the human operator explicitly decides the live demo path must
  be green
- No lane should overlap file ownership without an explicit handoff

## Claude Orchestration Contract

- Claude is the conductor for this feature pack.
- Claude should discover ready work with:
  - `bun run plans queue --agent codex --json`
  - `bun run plans queue --agent claude --json`
  - `bun run plans queue --agent claude --lane docs --json`
- Every Codex lane should be run through `codex exec` on `gpt-5.4`.
- Treat `medium` as out of scope for this sprint. Use `high` by default and reserve `xhigh` for
  live-rails, privacy/security, and final-release risk.
- Preferred non-interactive pattern:

```bash
cat <lane-file> | codex exec -C /Users/afo/Code/greenpill/coop -m gpt-5.4 -c model_reasoning_effort="<effort>" -
```

### Claude Guardrails

- Scope lock:
  - Claude must only orchestrate lanes whose `feature` is `hackathon-release-readiness`.
  - Do not consume the global ready queue blindly just because other features are runnable.
  - The canonical lane set for this sprint is:
    - `lanes/state.codex.todo.md`
    - `lanes/api.codex.todo.md`
    - `lanes/contracts.codex.todo.md`
    - `lanes/docs.claude.todo.md`
    - `lanes/ui.claude.todo.md`
    - `qa/qa-codex.todo.md`
    - `qa/qa-claude.todo.md`
- Worktree isolation:
  - Each active lane should run on its own `work_branch` and in its own checkout or worktree.
  - Do not run multiple implementation lanes in the same mutable checkout.
  - Do not let one lane edit another lane's owned files without an explicit handoff.
- Dependency gating:
  - Start only the Phase 1 lanes in parallel.
  - Do not start `ui.claude` until `state.codex` and `api.codex` are done or otherwise explicitly
    stabilized.
  - Do not start `qa-codex` until all implementation lanes that affect the release candidate are
    complete.
  - Do not start `qa-claude` until `handoff/qa-claude/hackathon-release-readiness` exists.
  - Do not cross the Phase 1 -> Phase 2 boundary without an explicit human validation checkpoint.
  - Do not cross the Phase 2 -> Phase 3 boundary without an explicit human validation checkpoint.
  - Do not present the release recommendation as final without an explicit human validation
    checkpoint.
- Status hygiene:
  - Claude should update lane states as work progresses: `ready` -> `in_progress` -> `done` or
    `blocked`.
  - Claude should record findings and residual risk in `eval/qa-report.md` instead of leaving them
    only in chat.
- Release discipline:
  - Bug and testing lanes outrank polish and strategy.
  - If time pressure increases, defer strategy and non-blocking delight work before deferring
    reliability, privacy, or install-path clarity.
- Codex usage discipline:
  - If any Codex run fails because of quota, billing, auth, or rate-limit issues, Claude must pause
    the affected lane immediately.
  - Claude should not retry blindly, reshuffle more Codex lanes into flight, or consume additional
    Codex calls trying to "push through" the failure.
  - Claude should report the exact blocked lane and error class, continue only with safe
    Claude-owned work that does not require Codex, and then wait for explicit user direction before
    resuming Codex orchestration.

### Codex Effort Map

| Lane | Effort | Reason |
|------|--------|--------|
| `state.codex` | `high` | mixed setup-flow bug fixes plus shared metadata plumbing |
| `api.codex` | `high` | sync, pairing, and invite reliability need careful integration work |
| `contracts.codex` | `xhigh` | archive/live-rails/FVM work has the highest correctness risk |
| `qa-codex` | `xhigh` | final release gating and privacy/security calls are high-cost to get wrong |

## Lane Split

| Lane | Agent | Category | Phase | Expected Scope |
|------|-------|----------|-------|----------------|
| UI | Claude | polish | 2 | Chickens, Roost, popup-home, review clarity, presentation |
| Docs | Claude | documentation | 1 and 4 | landing/install path, demo story, tenets, monetization, roadmap |
| State | Codex | bugs | 1 | setup-flow consistency, passkey explanation, preview metadata plumbing |
| API | Codex | bugs | 1 | sync, pair-device, invites, receiver/Fly reliability |
| Contracts | Codex | bugs | 1 | archive/Filecoin/FVM readiness, live-rails contract, security edges |
| QA 1 | Codex | testing | 3 | validation matrix, privacy/security sweep, release recommendation |
| QA 2 | Claude | testing | 3 | manual UX pass, install/docs sanity, demo rehearsal |

## Acceptance Criteria

- [ ] popup and sidepanel create/join flows agree on optional Green Goods behavior
- [ ] passkey prompts explain why the passkey is needed without changing auth mechanics
- [ ] sync, receiver pairing, and invite flows have a clear validation result
- [ ] archive/Filecoin behavior is either demo-ready or explicitly gated with an operator checklist
- [ ] Chickens and Roost feel clear enough for a first-time demo user
- [ ] landing/docs make extension installation obvious for builders
- [ ] privacy claims made in product copy match the actual local-first behavior
- [ ] the release decision is supported by targeted validation, manual checks, and a residual-risk
      note

## Validation Plan

- Unit:
  - `bun run test`
  - targeted extension/shared/app tests added by the implementation lanes
- Integration:
  - `bun run validate:popup-slice`
  - `bun run validate:receiver-slice`
  - `bun run validate:sync-hardening`
- E2E:
  - `bun run test:e2e:sync`
  - `bun run test:e2e:receiver-sync`
  - `bun run validate:core-loop` if UI polish touches the primary extension flow materially
- Manual:
  - real Chrome confirmation for popup `Capture Tab` and `Screenshot`
  - landing -> docs -> install path walkthrough
  - browser-to-browser sync over Fly plus direct peer where feasible
  - pair-device flow
  - archive/Filecoin demo path

## References

- Related docs:
  - `docs/reference/current-release-status.md`
  - `docs/reference/demo-and-deploy-runbook.md`
  - `docs/reference/testing-and-validation.md`
  - `docs/reference/extension-install-and-distribution.md`
- Related plans:
  - `.plans/features/production-readiness/spec.md`
  - `.plans/features/filecoin-cold-storage/spec.md`
- Relevant files:
  - `packages/extension/src/views/shared/useCoopActions.ts`
  - `packages/extension/src/views/Popup/PopupCreateCoopScreen.tsx`
  - `packages/extension/src/views/Popup/PopupJoinCoopScreen.tsx`
  - `packages/extension/src/views/Sidepanel/hooks/useSyncBindings.ts`
  - `packages/extension/src/views/Sidepanel/tabs/ChickensTab.tsx`
  - `packages/extension/src/views/Sidepanel/tabs/RoostTab.tsx`
  - `packages/extension/src/views/Popup/PopupHomeScreen.tsx`
  - `packages/shared/src/modules/fvm/fvm.ts`
- Open questions:
  - whether the live demo path must be green or whether mock-first is sufficient for the hackathon
