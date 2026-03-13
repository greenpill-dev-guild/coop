# Coop Current State Review

Date: March 11, 2026

Reviewed against:

- `/Users/afo/Downloads/coop-os-architecture.md`
- `/Users/afo/Downloads/coop-os-architecture-vnext (1).md`
- `/Users/afo/Downloads/Luiz X Afo Coffee - 2026_03_05 09_58 PST - Notes by Gemini.md`
- `/Users/afo/Downloads/Meeting started 2026_03_10 10_11 PDT - Notes by Gemini.md`
- `docs/coop-os-architecture-vnext.md`
- `docs/meeting-followups-2026-03-10.md`

## Where Coop Is Right Now

Coop has moved through three distinct scopes in under two weeks:

1. The March 1 to March 3 architecture framed Coop as a broader browser-native coordination OS with four pillars, richer identity layers, hardware portability, and a larger long-term mesh model.
2. The March 5 and March 10 discussions narrowed that into a hackathon MVP centered on passive browser capture, explicit review, shared memory, capital formation, and anchor-node-backed inference.
3. The repo's current canonical `docs/coop-os-architecture-vnext.md` narrows v1 further: as of March 11, 2026, the extension is the real product surface and `packages/app` is intentionally just the landing page.

The codebase matches the third scope better than the earlier docs. The main mismatch is that the March 9 draft still describes `PWA = receiver`, while the repo's locked v1 architecture now explicitly removes a separate mobile receiver route from scope.

## Completed

- Monorepo structure is in place with `packages/app`, `packages/extension`, and `packages/shared`.
- The extension has the expected MV3 surfaces: popup, sidepanel, background worker, manifest, runtime message bridge, and icon-state handling.
- Shared browser-local persistence exists through Dexie and Yjs document serialization.
- Passkey-first identity is implemented for local session creation and member projection.
- Coop creation is implemented, including setup insights, seed contribution, and Safe state resolution in mock or live mode.
- The onchain path is now standardized on `Ethereum Sepolia` for default test and development flows, with `Arbitrum One` available only when explicitly configured for production-oriented validation.
- Invite generation and join flows are implemented.
- Multi-profile peer sync exists through Yjs plus `y-webrtc`, with health reporting back into the extension UI.
- Passive capture exists for browser tabs, including extract shaping and heuristic local interpretation into review drafts.
- Review and publish flows exist, including cross-coop publish targets.
- Archive and export flows exist for artifacts, snapshots, and archive receipts.
- Automated validation already exists through Vitest and Playwright, including a full two-profile extension workflow.

## Incomplete Or Stubbed

- The app is not a receiver PWA. There is no pairing flow, no capture inbox, no voice capture, and no cross-device note flow.
- The local enhancement path is still heuristic-first. WebLLM or any other real local model execution is not implemented.
- Trusted-node capability is mostly conceptual. The code distinguishes roles, but there is not yet a stronger operational anchor runtime beyond env-gated live integrations.
- Green Goods garden binding is not implemented and remains intentionally deferred until after the Arbitrum/Sepolia Safe path is stable.
- Archive upload delegation assumes an external issuer service in live mode. That service is not part of this repo.
- Filecoin lifecycle tracking stops at receipt creation. Follow-up indexing or seal-status refresh is not implemented.
- Review ritual support exists only as grouped read views. There is no explicit weekly ritual scheduler, facilitator flow, or meeting-mode review surface.
- The identity model is simpler than the earliest architecture. Per-coop DID, signed CRDT envelopes, and richer transport/member/co-op identity separation are not in the current implementation.
- Multi-coop membership is present in data shape and publish routing, but the UX is still shallow. It does not yet feel passive and low-friction for people operating across several coops at once.

## Explicitly Out Of Scope Or No Longer Planned For Current V1

These items appear in earlier discussions, but the repo's locked v1 architecture now excludes them:

- Mobile receiver shell
- Mobile voice capture
- Transcript capture on mobile
- Local file or folder ingest
- PDF library ingest
- App-level capture outside the browser
- Full React Flow editing
- Full Green Goods garden binding
- Built-in API-key cloud LLM integrations
- Autonomous agent execution
- Session-key transaction flows
- End-user skill management UI

The March 5 notes also explicitly removed Telegram and Bluesky from immediate hackathon scope. The March 10 notes keep those ideas alive as later trusted-node capabilities, but they are not part of the current build plan.

## Current App State

`packages/app` is a polished landing and onboarding surface, not an operational runtime.

What it does well:

- communicates the product story clearly
- exposes the four-lens setup ritual
- works on desktop and mobile layouts
- matches the locked v1 narrative in the architecture

What it does not do yet:

- install as a real receiver PWA
- capture voice or notes
- pair with the extension
- reflect live coop state
- host a review inbox or member dashboard

## Current Extension State

`packages/extension` is the real Coop product surface today.

Implemented product loop:

- create a coop
- create trusted or member invites
- join from a second browser profile
- manually round up tabs
- review and edit drafts in the Roost
- push drafts into shared coop memory
- sync published state between peers
- archive an artifact or snapshot
- export snapshot, artifact, and receipt bundles

What still feels prototype-level:

- relevance scoring is deterministic and lightweight, not meaningfully learned
- capture cadence is global, not coop-aware
- trust/anchor behavior is not yet operationally distinct
- error handling exists, but recovery UX is still basic
- the multi-coop workflow is technically present more than it is product-polished

## Best Next Phases For The Next Couple Of Days

### Phase 1: Tighten The Core Extension Loop

Focus on the extension path that already exists instead of expanding surfaces again.

- Improve empty, error, and recovery states in the sidepanel.
- Make multi-coop review more legible: active coop switching, publish-target clarity, and draft routing confidence.
- Add better state visibility around sync, archive mode, and live/mock integration mode.

### Phase 2: Validate The Real Integration Boundaries

Run the current mock loop until it is boring, then validate live edges one at a time.

- Live Safe creation on Arbitrum with Sepolia as the test path, and narrow the runtime to those two chain targets only.
- Live Storacha delegation and upload against a working issuer.
- Stable signaling for multi-profile sync outside the local demo environment.

### Phase 3: Add Just Enough Genericization

Do not genericize the whole brand. Genericize the underlying container model.

- Add a `space type` or `coop archetype` field to the shared profile.
- Keep the current community/co-op ritual as the default preset.
- Add additional presets later for `friends`, `family`, `project`, and `personal`.
- Preserve one common artifact model so all types still share the same capture, review, publish, and archive loop.

## How To Make Coop More Generic Without Losing The Current Direction

The safest path is not “replace coop with a generic workspace.” The safer path is “keep Coop as the membrane product, but let the membrane serve different relationship types.”

Recommended shape:

- `community`: current default; good for local chapters, co-ops, and networks
- `project`: lighter-weight temporary collaboration
- `friends`: casual shared curation and planning
- `family`: household memory, planning, and resource sharing
- `personal`: private cross-device note capture and synthesis for one person

To support that, the next architectural step should be:

1. add `spaceType` to the shared profile and onboarding flow
2. move setup lenses from hard-coded fields to preset packs
3. let personal mode default to one-member private sync first, then optional invite sharing later
4. keep the extension-first capture and archive machinery shared across every mode

The most compelling near-term genericization is `personal`. It directly matches your “you across devices” idea and lets Coop prove value even before a full group review ritual happens.

## Testing And Validation Read

The repo already has a solid base:

- unit and integration tests across shared logic
- desktop and mobile landing-page Playwright checks
- a strong extension E2E that covers create, join, sync, capture, publish, and archive

What was missing was a named validation entrypoint. That is now documented in `docs/testing-and-validation.md` and backed by `scripts/validate.mjs` so Codex can run targeted suites instead of only one broad `playwright test` command.
