# Next-Step Review

**Feature**: `next-step-review`  
**Status**: Active  
**Source Branch**: `feature/next-step-review`  
**Created**: `2026-05-06`  
**Last Updated**: `2026-05-06`

## Summary

Coop should feel like a local-first browser assistant for turning scattered knowledge into reviewed
opportunities and shared memory for your community or project. This pass makes Roost and Chickens
feel more like an assistant that prepares useful next steps and gets quieter when a member says a
suggestion is not useful.

## Why Now

- UX Surface Clarity hid the advanced agent plane, but review cards still had too little feedback
  control.
- Consumer-grade assistant behavior depends on salience: Coop needs a simple way to learn when a
  signal, draft, or pending observation should stop interrupting the member.
- The next release should improve load-lifting inside the existing browser/community wedge instead
  of adding new autonomous domains.

## Scope

### In Scope

- Local-only `ReviewItemFeedback` records for `not-useful` and `remind-later`.
- Dashboard, badge, proactive-signal, and Chickens review filtering based on active feedback.
- Roost "What's Next" copy that avoids raw agent-management language in simple mode.
- Chickens review-card actions for "Not useful" and "Remind later".
- Review-card detail language that answers: what Coop noticed, why it may matter, where it came
  from, and what the next move would be.
- A lightweight source/provenance cue for review cards, using existing source, draft, observation,
  and trace references without exposing raw agent logs in simple mode.

### Out Of Scope

- New consumer-life connectors, cloud inference, or broad autonomous execution.
- Onchain, policy, permit, archive, session, or API-server behavior changes.
- Parsing free-text ritual cadence into a real calendar schedule.
- Deleting local drafts when a member marks them not useful.

## User-Facing Outcome

- Members see fewer repeated low-value suggestions.
- Review cards explain what Coop noticed, why it may matter, and the suggested next move.
- Review cards give members enough provenance to trust or dismiss the suggestion without managing
  the agent runtime.
- "Not useful" quiets a card without deleting the underlying local draft.
- "Remind later" hides a card until the next review window fallback, currently three days.
- Publish/share/push actions still require explicit confirmation.

## Permission Boundary

This feature stays on the read/suggest/draft steps of the trust ladder. Coop may prepare, hide, or
refresh local review suggestions, but it does not publish, buy, sign, send, or execute anything
without the existing explicit user confirmation path.

## Technical Notes

- Shared contract/storage: `ReviewItemFeedback` lives in shared schemas and Dexie.
- Runtime boundary: `record-review-feedback` is an extension-local runtime message.
- Dashboard truth: summary counts, proactive signals, tab routings, and returned dashboard feedback
  all use active feedback suppression.
- UI truth: Chickens filters review items with stable feedback subjects so merged signal+draft cards
  behave as one card.
- Provenance truth: simple mode should expose source and reason in plain language, while trace IDs,
  provider/model details, and raw prompt/output hashes remain advanced/debug evidence.

## Lane Split

| Lane | Agent | Expected Scope |
|------|-------|----------------|
| State | Codex | Shared schema, Dexie table, CRUD helpers, active feedback filtering |
| API | Codex | Extension runtime message and background handler |
| UI | Claude | Roost copy, Chickens card actions, card detail language |
| QA 1 | Codex | Storage, runtime, dashboard, and render regression checks |
| QA 2 | Claude | Browser/visual sweep of Roost and Chickens simple/advanced modes |

## Acceptance Criteria

- [x] `ReviewItemFeedback` schema and Dexie storage exist.
- [x] `record-review-feedback` records local feedback.
- [x] `not-useful` suppresses review items and dismisses matching routings or observations when
  those statuses exist.
- [x] `remind-later` suppresses items until `remindAt`.
- [x] Dashboard summary counts and proactive signals honor active feedback.
- [x] Chickens cards expose `Not useful` and `Remind later`.
- [x] Roost simple copy avoids "stale observation", "Run Agent", and agent-management framing.
- [ ] Review cards answer what Coop noticed, why it matters, where it came from, and what happens
  next without exposing raw agent telemetry in simple mode.
- [ ] Manual browser/visual sweep completed before release handoff.

## Validation Plan

- Unit: shared Dexie feedback persistence and expiry.
- Integration: background `record-review-feedback`, dashboard summary/proactive filtering.
- UI: Roost copy and Chickens feedback controls/filtering.
- Manual: browser check of Roost and Chickens in simple and advanced modes.

## References

- `.plans/features/ux-surface-clarity/spec.md`
- `docs/reference/coop-strategy.md`
- `packages/shared/src/modules/storage/db-crud-agent.ts`
- `packages/extension/src/background/dashboard.ts`
- `packages/extension/src/background/handlers/review.ts`
- `packages/extension/src/views/Sidepanel/tabs/ChickensTab.tsx`
- `packages/extension/src/views/Sidepanel/tabs/RoostFocusSection.tsx`
