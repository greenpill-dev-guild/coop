# Agent Control Plane

**Feature**: `agent-control-plane`
**Status**: Backlog
**Source Branch**: `feature/agent-control-plane`
**Created**: `2026-05-21`
**Last Updated**: `2026-05-21`

## Summary

Capture the future control-plane work Coop needs before production agents can safely act across
runtime, identity, data, tool authority, spending, observability, and emergency stop controls.
This is a planning hub only: no runtime behavior, schema, API, or UI behavior changes are part of
the save.

## Why Now

Coop already parallels many agent-infrastructure control layers through local-first runtime,
passkey/member authority, provenance-aware data, policy permits, and review-before-share product
loops. The remaining risk is not one missing vendor integration; it is the absence of a single
backlog owner for the cross-cutting gaps that become important once agents can act for users or
coops over time.

The gap analysis from Nick B. Jones's control-layer framing identified four areas that should not
be lost in existing feature plans:

- Unified kill switch behavior across runtime cancellation, identity/session revocation, policy
  blocks, and spend limits.
- A consolidated operator run ledger that observes agent work as goal-directed work, not only
  logs, traces, or isolated test evidence.
- Runtime durability proof for browser-native agents that need to pause, resume, retry, recover,
  or wake later.
- Clear ownership boundaries between this cross-cutting control plane and existing scoped spending
  and session-key plans.

## Scope

### In Scope

- Define the seven control-layer questions Coop must answer before this work leaves backlog:
  runtime, identity, data, tools/change authority, spend, observability, and kill switch.
- Capture the future shared/runtime primitives needed for run ledger, policy/tool decision
  records, cancellation, revocation, and resumable runtime proof.
- Capture the future advanced/operator UI surfaces needed to inspect and stop agent work without
  turning the default Coop UX into an operator console.
- Define the activation order, default principal model, privacy posture, kill-switch matrix, and
  scenario acceptance tests needed before implementation starts.
- Reference existing feature hubs that already own scoped spending, session lifecycle, provenance,
  and release-readiness work.

### Out Of Scope

- Implementing any agent runtime, schema, storage, API, contract, UI, or validation change.
- Moving work out of `agent-evolution`, `session-key-phase-2`, `agent-knowledge-sandbox`, or
  `production-readiness`.
- Adding Stripe, Auth0/Okta, Snowflake/Databricks, Datadog, Cloudflare, AWS, or other external
  enterprise control-plane vendors by default.
- Exposing operator controls in the default simple Coop experience.

## User-Facing Outcome

- Nothing changes for end users when this hub is saved.
- Future users should eventually get safer agent behavior: clearer approval, revocation, recovery,
  and stop controls when agents act on behalf of a person or coop.
- Future operators should eventually get an advanced view of agent work, policy decisions, data
  sources, costs or spend-like limits, and stop/revoke controls.
- The default Coop product should remain a friendly local-first browser assistant for turning
  scattered knowledge into reviewed opportunities and shared memory for a community or project.

## Technical Notes

These are future notes, not current implementation instructions.

### Seven Control-Layer Questions

1. **Runtime:** Where does the agent run, and how does browser-native work pause, resume, retry,
   wake later, and recover from offscreen/service-worker/tool failures?
2. **Identity:** Who is the principal: the user, the coop, the application, a delegated session,
   or a future agent identity? What can be delegated and revoked?
3. **Data:** What can the agent know, which source bodies or metadata are authorized, and how are
   provenance, freshness, and shared-safe context preserved?
4. **Tools/change authority:** What can the agent read, draft, publish, sync, archive, transact,
   or deploy, and which policy records explain each tool decision?
5. **Spend:** What spend-like limits apply to refunds, Safe/session-key actions, onchain actions,
   archive costs, model costs, or future scoped commerce?
6. **Observability:** What goal was the agent pursuing, which tools/data/policies were involved,
   who approved it, what did it cost, and did a human accept the result?
7. **Kill switch:** Who can stop the agent, and at which layers: runtime, session/permit, policy
   gateway, payment/spend rail, sync/archive, or workflow node?

### Promotion Sequence

Promote this hub in small slices. Do not start with UI controls that have no real state or stop
primitive behind them.

1. **Run ledger foundation:** define and persist metadata-first agent run and tool decision records.
2. **Kill-switch semantics:** define who can stop what at runtime, session/permit, policy,
   spend-like, sync, and archive layers.
3. **Runtime durability proof:** prove at least one interrupted browser-agent run can recover,
   retry, resume, or wake later with ledger continuity.
4. **Advanced UI integration:** expose operator inspection and stop/revoke controls only after real
   state/runtime affordances exist.
5. **Operator reference docs:** promote a docs lane only after the behavior is implemented and
   stable enough to explain accurately.

### Principal Model Default

Every agent run should record both sides of authority:

- `requestedBy`: the human member, local user, or coop actor that asked for the work.
- `actingScope`: the authority used to execute work, such as `local-app-runtime`,
  `delegated-session`, `coop-authorized-capability`, or a future `agent-identity`.
- `revokedBy`: the member, operator, policy rule, or runtime condition that stopped or narrowed
  the run, when applicable.

The v1 default should be conservative: local inference and drafting run as `local-app-runtime`;
privileged actions require an explicit delegated session or coop-authorized capability.

### Observability Privacy Defaults

The run ledger is an operability surface, not a new shared data exhaust. Default behavior should be:

- Local-only and metadata-first unless the user explicitly publishes or syncs a record.
- No raw source bodies, secrets, tokens, private prompts, or unredacted retrieved content in shared
  ledgers.
- Source references should point to local/private content by opaque IDs and include only
  shared-safe labels when exported.
- Retention should be explicit before implementation: either bounded local retention or user-visible
  cleanup controls.
- Any future remote observability integration must be opt-in and treat prompts, source bodies,
  credentials, and private member context as sensitive data.

### Kill-Switch Matrix

Before implementation, each stop layer needs one clear owner, effect, and ledger proof.

| Layer | Triggered By | Stops | Ledger Proof |
|------|--------------|-------|--------------|
| Runtime cancel | User, operator, timeout, retry budget | Active local/offscreen run and future retries for that run | Run status, reason, timestamp, interrupted step |
| Session/permit revoke | User/member, coop policy, expiry, usage cap | Privileged delegated actions and session-scoped tool calls | Revoked scope, revoker, affected actions |
| Policy block | Static policy, approval rule, risk threshold | Tool call before execution | Tool decision record with blocked reason |
| Spend-like limit | Usage cap, archive/model/onchain budget, scoped spending rule | Cost-bearing or value-moving action | Limit, attempted amount/cost, blocked action |
| Sync/archive pause | User/operator, privacy rule, failed proof | Publishing, shared sync, archive upload, or proof finalization | Paused destination, source record, recovery path |
| Workflow interrupt | Review gate, sensitive node, human approval wait | Workflow progression past the gated step | Pending approval state and allowed next actions |

### Future State Lane Shape

- Shared modules likely involved: `agent`, `policy`, `session`, `permit`, `storage`, `sync-core`,
  and related schemas.
- Extension runtime likely involved: background handlers, offscreen runtime, agent runner, and
  dashboard/event plumbing.
- Persisted-state or message-contract changes must remain backwards compatible and should be
  called out as human judgment items before implementation.

### Future UI Lane Shape

- Operator surfaces should live in advanced/trusted areas such as Nest, Roost, or other builder
  surfaces, not the default capture/review flow.
- UI should inspect, pause, revoke, retry, or explain agent work; it should not teach the model to
  stop by prompt alone.
- Any new controls must reuse existing extension UI patterns and design tokens.

## Lane Split

| Lane | Agent | Expected Scope |
|------|-------|----------------|
| State | Codex | Shared/runtime primitives for run ledger, tool decisions, cancellation, revocation, and durability proof |
| UI | Claude | Advanced/operator surfaces after state primitives exist; fixtures only if started earlier |
| API | Codex | `n/a` for this backlog save |
| Contracts | Codex | `n/a` for this backlog save; existing session/permit work remains in `session-key-phase-2` |
| Docs | Codex | `n/a` until implemented semantics are stable enough for an operator reference |
| QA 1 | Codex | Blocked until implementation lanes are promoted and completed |
| QA 2 | Claude | Blocked until QA pass 1 completes |

## Save Acceptance Criteria

- [x] New backlog hub exists at `.plans/features/agent-control-plane/`.
- [x] `status.json` marks `stage: backlog`, `ui: backlog`, `state: backlog`, `api: n/a`,
  `contracts: n/a`, `docs: n/a`, and QA blocked behind UI/state.
- [x] Spec answers how the seven control-layer questions apply to Coop.
- [x] Context references related hubs without editing those hubs.
- [x] API/contracts lane files are neutralized or aligned with `n/a` status.
- [x] `bun run plans validate` passes after the hub is saved.

## Future Implementation Acceptance

- [ ] A run ledger records goal, requested actor, acting scope, status, policy decisions, tool calls,
  data-source references, approval state, cost/spend-like limits, outcome, and stop/revoke events.
- [ ] Ledger records are metadata-first, local-only by default, and do not expose source bodies,
  secrets, private prompts, tokens, or unredacted retrieved content.
- [ ] Stop/revoke behavior is implemented at more than the model-prompt layer and covers runtime,
  session/permit, policy, spend-like, sync/archive, and workflow-interrupt cases where applicable.
- [ ] Runtime durability proof shows an interrupted browser-agent run can recover, retry, resume, or
  wake later without losing the ledger trail.
- [ ] Advanced UI reads real run/control state and does not expose operator controls in the default
  simple Coop experience.
- [ ] A docs lane is promoted only after state/UI behavior is stable enough to document as an
  operator reference.

## Validation Plan

- Plan validation: `bun run plans validate`.
- Diff check: `git diff -- .plans/features/agent-control-plane/`.
- Optional queue sanity: `bun run plans queue --agent codex` and
  `bun run plans queue --agent claude --lane ui` should not make this backlog hub queueable.

Future validation scenarios before production readiness:

- Runaway retry loop is stopped and ledgered.
- Delegated session or permit is revoked mid-run and privileged actions stop.
- Unauthorized or private source content is not surfaced through the ledger or UI.
- Offline/interrupted browser runtime recovers with the same run identity and status history.
- Stale or blocked tool decision cannot silently fall through to execution.
- Spend-like limit blocks a value-moving or cost-bearing action with a clear reason.
- User/operator stop during an active run prevents further tool calls and records the stopping
  layer.

## References

- Related hubs:
  - `.plans/features/agent-evolution/`
  - `.plans/features/session-key-phase-2/`
  - `.plans/features/agent-knowledge-sandbox/`
  - `.plans/features/production-readiness/`
- Planning source: Nick B. Jones control-layer transcript provided in the conversation that created
  this hub.
- Activation default: run ledger first, then kill-switch semantics, then runtime durability proof,
  then advanced UI integration.
